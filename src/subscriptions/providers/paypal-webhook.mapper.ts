import type { SubscriptionPaymentEvent, } from '../interfaces/subscription-payment-event.interface';

function asRecord( value: unknown, field: string, ): Record<string, unknown> {
    if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value)
    ) {
        throw new Error(`El campo ${field} es inválido.`);
    }

    return value as Record<string, unknown>;
}

function requiredString( value: unknown, field: string, ): string {
    if (
        typeof value !== 'string' ||
        value.trim().length === 0
    ) {
        throw new Error(`El campo ${field} es obligatorio.`);
    }

    return value;
}

function requiredDate(
    value: unknown,
    field: string,
): Date {
    const date = new Date(requiredString(value, field));

    if (!Number.isFinite(date.getTime())) {
        throw new Error(`La fecha ${field} es inválida.`);
    }

    return date;
}

export function mapPayPalWebhookEvent(
    payload: unknown,
): SubscriptionPaymentEvent {
    const event = asRecord(payload, 'evento');

    const eventType = requiredString(
        event.event_type,
        'event_type',
    );

    const resource = asRecord(
        event.resource,
        'resource',
    );

    switch (eventType) {
        case 'PAYMENT.SALE.COMPLETED': {
            const amount = asRecord(
                resource.amount,
                'resource.amount',
            );

            return {
                type: 'PAYMENT_SUCCEEDED',

                externalSubscriptionReference:
                    requiredString(
                        resource.billing_agreement_id,
                        'resource.billing_agreement_id',
                    ),

                externalPaymentReference:
                    requiredString(
                        resource.id,
                        'resource.id',
                    ),

                amount: requiredString(
                    amount.total,
                    'resource.amount.total',
                ),

                currencyCode: requiredString(
                    amount.currency,
                    'resource.amount.currency',
                ),

                paidAt: requiredDate(
                    resource.update_time ??
                        resource.create_time,
                    'fecha del pago',
                ),
            };
        }

        case 'BILLING.SUBSCRIPTION.CANCELLED':
            return {
                type: 'SUBSCRIPTION_CANCELED',

                externalSubscriptionReference:
                    requiredString(
                        resource.id,
                        'resource.id',
                    ),
            };

        default:
            throw new Error(
                `El evento ${eventType} todavía no tiene procesamiento implementado.`,
            );
    }
}