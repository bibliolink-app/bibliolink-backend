import type {
    SubscriptionPaymentEvent,
} from './subscription-payment-event.interface';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentWebhookRequest {
    rawBody: Buffer;
    headers: Record<
        string,
        string | string[] | undefined
    >;
}

export interface ExternalSubscriptionIdentity {
    checkoutReference: string;

    status:
        | 'APPROVAL_PENDING'
        | 'APPROVED'
        | 'ACTIVE'
        | 'SUSPENDED'
        | 'CANCELLED'
        | 'EXPIRED';
}

export interface SubscriptionBillingInfo {
    lastPaymentAt: Date | null;
    nextBillingTime: Date | null;
}

export interface ConfirmedPayment {
    externalReference: string;
    amount: string;
    currencyCode: string;
    paidAt: Date;
}

export interface PaymentProvider {
    getSubscriptionIdentity(
        externalSubscriptionReference: string,
    ): Promise<ExternalSubscriptionIdentity>;

    getSubscriptionBillingInfo(
        externalSubscriptionReference: string,
    ): Promise<SubscriptionBillingInfo>;

    getConfirmedPayment(
        externalSubscriptionReference: string,
        externalPaymentReference: string,
        eventDate: Date,
    ): Promise<ConfirmedPayment>;

    parseVerifiedWebhook(
        input: PaymentWebhookRequest,
    ): Promise<SubscriptionPaymentEvent>;
}