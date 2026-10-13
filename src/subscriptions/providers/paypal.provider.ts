import { BadRequestException, HttpException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException, } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { envs } from '../../config/envs';
import type { PayPalAccessTokenResponse } from './interfaces/paypal-access-token-response.interface';

import { type ConfirmedPayment, type ExternalSubscriptionIdentity, type PaymentProvider, type PaymentWebhookRequest, type SubscriptionBillingInfo, } from '../interfaces/payment-provider.interface';
import type { PayPalWebhookVerificationInput, PayPalWebhookVerificationResponse, } from './interfaces/paypal-webhook-verification.interface';
import { PayPalSubscriptionDetailsResponse } from './interfaces/paypal-subscription-details-response.interface';
import { mapPayPalWebhookEvent } from './paypal-webhook.mapper';
import { SubscriptionPaymentEvent } from '../interfaces/subscription-payment-event.interface';
import { PayPalTransaction, PayPalTransactionsResponse } from './interfaces/paypal-transactions-response.interface';


const REQUEST_TIMEOUT_MS = 5000;
const TOKEN_EXPIRY_MARGIN_SECONDS = 60;

@Injectable()
export class PayPalProvider implements PaymentProvider {
    private accessToken: string | null = null;
    private accessTokenExpiresAt = 0;

    constructor(
        @InjectPinoLogger(PayPalProvider.name)
        private readonly logger: PinoLogger,
    ) { }

    // 1. Consultar la identidad de una suscripción.
    async getSubscriptionIdentity(
    externalSubscriptionReference: string,
): Promise<ExternalSubscriptionIdentity> {
    const result = await this.fetchSubscriptionDetails(
        externalSubscriptionReference,
    );

    if (
        typeof result.custom_id !== 'string' ||
        !result.custom_id.trim()
    ) {
        throw new BadRequestException(
            'La suscripción no contiene una referencia de checkout válida.',
        );
    }

    if (
        result.status !== 'APPROVAL_PENDING' &&
        result.status !== 'APPROVED' &&
        result.status !== 'ACTIVE' &&
        result.status !== 'SUSPENDED' &&
        result.status !== 'CANCELLED' &&
        result.status !== 'EXPIRED'
    ) {
        throw new ServiceUnavailableException(
            'El proveedor devolvió un estado de suscripción desconocido.',
        );
    }

    return {
        checkoutReference: result.custom_id,
        status: result.status,
    };
}


    // 2. Consultar su información de facturación.
    async getSubscriptionBillingInfo(externalSubscriptionReference: string,): Promise<SubscriptionBillingInfo> {
        const result = await this.fetchSubscriptionDetails(
            externalSubscriptionReference,
        );

        try {
            return {
                lastPaymentAt: this.parsePayPalDate(
                    result.billing_info?.last_payment?.time,
                ),

                nextBillingTime: this.parsePayPalDate(
                    result.billing_info?.next_billing_time,
                ),
            };
        } catch (error: unknown) {
            this.logger.error(
                {
                    err: error,
                    externalSubscriptionReference,
                },
                'El proveedor devolvió información de facturación inválida',
            );

            throw new ServiceUnavailableException(
                'No fue posible consultar la información de facturación.',
            );
        }
    }


    // 3. Confirmar un cobro.
    async getConfirmedPayment(externalSubscriptionReference: string, externalPaymentReference: string, eventDate: Date,): Promise<ConfirmedPayment> {
        let statusCode: number | undefined;

        try {
            if (
                !externalSubscriptionReference.trim() ||
                !externalPaymentReference.trim() ||
                !Number.isFinite(eventDate.getTime())
            ) {
                throw new Error(
                    'Los datos de consulta del pago son inválidos.',
                );
            }

            const accessToken = await this.getAccessToken();

            const startTime = new Date(eventDate);
            startTime.setUTCDate(startTime.getUTCDate() - 7);

            const endTime = new Date(eventDate);
            endTime.setUTCDate(endTime.getUTCDate() + 7);

            const url = new URL(
                `${envs.payments.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(externalSubscriptionReference)}/transactions`,
            );

            url.searchParams.set(
                'start_time',
                startTime.toISOString(),
            );

            url.searchParams.set(
                'end_time',
                endTime.toISOString(),
            );

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                redirect: 'error',
            });

            statusCode = response.status;

            if (!response.ok) {
                throw new Error(
                    'No fue posible consultar los cobros de la suscripción.',
                );
            }

            const result: unknown = await response.json();

            if (!this.isTransactionsResponse(result)) {
                throw new Error(
                    'El proveedor devolvió un listado de cobros inválido.',
                );
            }

            const payment = result.transactions.find(
                (transaction) =>
                    transaction.id === externalPaymentReference,
            );

            if (!payment) {
                throw new Error(
                    'No se encontró el cobro en la suscripción indicada.',
                );
            }

            if (payment.status !== 'COMPLETED') {
                throw new Error(
                    'El cobro todavía no está confirmado.',
                );
            }

            const paidAt = new Date(payment.time);

            if (!Number.isFinite(paidAt.getTime())) {
                throw new Error(
                    'El proveedor devolvió una fecha de pago inválida.',
                );
            }

            const {
                value,
                currency_code: currencyCode,
            } = payment.amount_with_breakdown.gross_amount;

            if (
                !/^\d+(?:\.\d{1,2})?$/.test(value) ||
                !/^[A-Z]{3}$/.test(currencyCode)
            ) {
                throw new Error(
                    'El proveedor devolvió un importe de pago inválido.',
                );
            }

            return {
                externalReference: payment.id,
                amount: value,
                currencyCode,
                paidAt,
            };
        } catch (error: unknown) {
            this.logger.error(
                {
                    err: error,
                    statusCode,
                    externalSubscriptionReference,
                    externalPaymentReference,
                },
                'No fue posible confirmar el cobro con el proveedor',
            );

            throw new ServiceUnavailableException(
                'No fue posible confirmar el pago.',
            );
        }
    }

    // 4. Verificar e interpretar un webhook.
    async parseVerifiedWebhook(input: PaymentWebhookRequest,): Promise<SubscriptionPaymentEvent> {
        if (!envs.payments.webhookId) {
            throw new ServiceUnavailableException(
                'El webhook del proveedor de pagos no está configurado.',
            );
        }

        const getHeader = (name: string): string => {
            const value = input.headers[name];

            return typeof value === 'string' ? value : '';
        };

        const verified = await this.verifyWebhook({
            webhookId: envs.payments.webhookId,
            rawBody: input.rawBody,
            headers: {
                authAlgo: getHeader('paypal-auth-algo'),
                certUrl: getHeader('paypal-cert-url'),
                transmissionId: getHeader('paypal-transmission-id'),
                transmissionSignature: getHeader(
                    'paypal-transmission-sig',
                ),
                transmissionTime: getHeader(
                    'paypal-transmission-time',
                ),
            },
        });

        if (!verified) {
            throw new UnauthorizedException(
                'La notificación de pago no es auténtica.',
            );
        }

        let payload: unknown;

        try {
            payload = JSON.parse(
                input.rawBody.toString('utf8'),
            );
        } catch {
            throw new BadRequestException(
                'El contenido de la notificación es inválido.',
            );
        }

        return mapPayPalWebhookEvent(payload);
    }

    // MÉTODOS INTERNOS
    private async fetchSubscriptionDetails(externalSubscriptionReference: string,): Promise<PayPalSubscriptionDetailsResponse> {
        if (!externalSubscriptionReference?.trim()) {
            throw new BadRequestException(
                'La referencia externa de la suscripción es obligatoria.',
            );
        }

        let statusCode: number | undefined;

        try {
            const accessToken = await this.getAccessToken();

            const response = await fetch(
                `${envs.payments.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(externalSubscriptionReference)}`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/json',
                    },
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                    redirect: 'error',
                },
            );

            statusCode = response.status;

            if (response.status === 404) {
                throw new NotFoundException(
                    'La suscripción no existe en el proveedor de pagos.',
                );
            }

            if (!response.ok) {
                throw new Error(
                    'No fue posible consultar la suscripción en el proveedor de pagos.',
                );
            }

            const result: unknown = await response.json();

            if (!this.isSubscriptionDetailsResponse(result)) {
                throw new Error(
                    'El proveedor devolvió detalles de suscripción inválidos.',
                );
            }

            if (
                result.id !== externalSubscriptionReference ||
                result.plan_id !== envs.payments.planId
            ) {
                throw new BadRequestException(
                    'La suscripción no corresponde al plan configurado.',
                );
            }

            return result;
        } catch (error: unknown) {
            if (error instanceof HttpException) {
                throw error;
            }

            this.logger.error(
                {
                    err: error,
                    statusCode,
                    externalSubscriptionReference,
                },
                'No fue posible consultar la suscripción con el proveedor',
            );

            throw new ServiceUnavailableException(
                'No fue posible consultar la suscripción.',
            );
        }
    }

    async getAccessToken(): Promise<string> {

        if (this.accessToken && Date.now() < this.accessTokenExpiresAt) {
            return this.accessToken;
        }

        let statusCode: number | undefined;

        try {
            const credentials = Buffer.from(`${envs.payments.clientId}:${envs.payments.clientSecret}`,).toString('base64');

            const response = await fetch(
                `${envs.payments.baseUrl}/v1/oauth2/token`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type':
                            'application/x-www-form-urlencoded',
                        Accept: 'application/json',
                    },
                    body: new URLSearchParams({
                        grant_type: 'client_credentials',
                    }),
                    signal: AbortSignal.timeout(
                        REQUEST_TIMEOUT_MS,
                    ),
                    redirect: 'error',
                },
            );

            statusCode = response.status;

            if (!response.ok) {
                throw new Error(
                    'Payment provider authentication failed.',
                );
            }

            const result: unknown = await response.json();

            if (!this.isAccessTokenResponse(result)) {
                throw new Error(
                    'Payment provider returned an invalid access token response.',
                );
            }

            this.accessToken = result.access_token;

            this.accessTokenExpiresAt =
                Date.now() +
                Math.max(
                    0,
                    result.expires_in -
                    TOKEN_EXPIRY_MARGIN_SECONDS,
                ) *
                1000;

            this.logger.debug(
                'Payment provider authentication completed successfully',
            );

            return this.accessToken;
        } catch (error: unknown) {
            this.logger.error(
                { err: error, statusCode },
                'Payment provider authentication failed',
            );

            throw new ServiceUnavailableException(
                'El servicio de pagos no está disponible.',
            );
        }
    }



    async verifyWebhook(input: PayPalWebhookVerificationInput,): Promise<boolean> {
        const {
            webhookId,
            rawBody,
            headers,
        } = input;

        if (
            !webhookId ||
            !rawBody.length ||
            !headers.authAlgo ||
            !headers.certUrl ||
            !headers.transmissionId ||
            !headers.transmissionSignature ||
            !headers.transmissionTime
        ) {
            return false;
        }

        let statusCode: number | undefined;

        try {
            const webhookEvent: unknown = JSON.parse(
                rawBody.toString('utf8'),
            );

            if (
                typeof webhookEvent !== 'object' ||
                webhookEvent === null ||
                Array.isArray(webhookEvent)
            ) {
                return false;
            }

            const accessToken = await this.getAccessToken();

            const response = await fetch(
                `${envs.payments.baseUrl}/v1/notifications/verify-webhook-signature`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        auth_algo: headers.authAlgo,
                        cert_url: headers.certUrl,
                        transmission_id: headers.transmissionId,
                        transmission_sig: headers.transmissionSignature,
                        transmission_time: headers.transmissionTime,
                        webhook_id: webhookId,
                        webhook_event: webhookEvent,
                    }),
                    signal: AbortSignal.timeout(
                        REQUEST_TIMEOUT_MS,
                    ),
                    redirect: 'error',
                },
            );

            statusCode = response.status;

            if (!response.ok) {
                throw new Error(
                    'El proveedor de pagos no pudo verificar el webhook.',
                );
            }

            const result: unknown = await response.json();

            if (
                typeof result !== 'object' ||
                result === null ||
                Array.isArray(result) ||
                !('verification_status' in result)
            ) {
                throw new Error(
                    'El proveedor de pagos devolvió una respuesta de verificación inválida.',
                );
            }

            const verificationResult =
                result as PayPalWebhookVerificationResponse;

            if (verificationResult.verification_status === 'FAILURE') {
                this.logger.warn(
                    {
                        transmissionId: headers.transmissionId,
                    },
                    'Webhook rechazado por verificación de autenticidad',
                );

                return false;
            }

            if (verificationResult.verification_status !== 'SUCCESS') {
                throw new Error(
                    'El proveedor de pagos devolvió un estado de verificación desconocido.',
                );
            }

            return true;
        } catch (error: unknown) {
            this.logger.error(
                {
                    err: error,
                    statusCode,
                },
                'No fue posible verificar el webhook',
            );

            throw new ServiceUnavailableException(
                'No fue posible verificar la notificación de pago.',
            );
        }
    }


    private isSubscriptionDetailsResponse(value: unknown,): value is PayPalSubscriptionDetailsResponse {
        if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
        ) {
            return false;
        }

        const result = value as Record<string, unknown>;

        if (
            typeof result.id !== 'string' ||
            typeof result.plan_id !== 'string'
        ) {
            return false;
        }

        if (
            typeof result.status !== 'string' ||
            (
                result.custom_id !== undefined &&
                typeof result.custom_id !== 'string'
            )
        ) {
            return false;
        }

        if (result.billing_info === undefined) {
            return true;
        }

        if (
            typeof result.billing_info !== 'object' ||
            result.billing_info === null ||
            Array.isArray(result.billing_info)
        ) {
            return false;
        }

        const billingInfo = result.billing_info as Record<string, unknown>;

        if (
            billingInfo.next_billing_time !== undefined &&
            typeof billingInfo.next_billing_time !== 'string'
        ) {
            return false;
        }

        if (billingInfo.last_payment !== undefined) {
            if (
                typeof billingInfo.last_payment !== 'object' ||
                billingInfo.last_payment === null ||
                Array.isArray(billingInfo.last_payment)
            ) {
                return false;
            }

            const lastPayment =
                billingInfo.last_payment as Record<string, unknown>;

            if (typeof lastPayment.time !== 'string') {
                return false;
            }
        }

        return true;
    }


    private isTransactionsResponse(value: unknown,): value is PayPalTransactionsResponse {
        if (
            typeof value !== 'object' ||
            value === null ||
            Array.isArray(value)
        ) {
            return false;
        }

        const result = value as Record<string, unknown>;

        if (!Array.isArray(result.transactions)) {
            return false;
        }

        return result.transactions.every(
            (item: unknown): item is PayPalTransaction => {
                if (
                    typeof item !== 'object' ||
                    item === null ||
                    Array.isArray(item)
                ) {
                    return false;
                }

                const transaction =
                    item as Record<string, unknown>;

                if (
                    typeof transaction.id !== 'string' ||
                    typeof transaction.time !== 'string' ||
                    (
                        transaction.status !== undefined &&
                        typeof transaction.status !== 'string'
                    )
                ) {
                    return false;
                }

                const breakdown =
                    transaction.amount_with_breakdown;

                if (
                    typeof breakdown !== 'object' ||
                    breakdown === null ||
                    Array.isArray(breakdown)
                ) {
                    return false;
                }

                const grossAmount = (
                    breakdown as Record<string, unknown>
                ).gross_amount;

                if (
                    typeof grossAmount !== 'object' ||
                    grossAmount === null ||
                    Array.isArray(grossAmount)
                ) {
                    return false;
                }

                const amount =
                    grossAmount as Record<string, unknown>;

                return (
                    typeof amount.value === 'string' &&
                    typeof amount.currency_code === 'string'
                );
            },
        );
    }





    private isAccessTokenResponse(value: unknown,): value is PayPalAccessTokenResponse {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
        }

        const result = value as Record<string, unknown>;

        return (
            typeof result.access_token === 'string' &&
            result.access_token.length > 0 &&
            result.token_type === 'Bearer' &&
            typeof result.expires_in === 'number' &&
            Number.isFinite(result.expires_in) &&
            result.expires_in > 0
        );
    }


    private parsePayPalDate(value: string | undefined,): Date | null {
        if (value === undefined) {
            return null;
        }

        const date = new Date(value);

        if (!Number.isFinite(date.getTime())) {
            throw new Error(
                'El proveedor devolvió una fecha de facturación inválida.',
            );
        }

        return date;
    }


}