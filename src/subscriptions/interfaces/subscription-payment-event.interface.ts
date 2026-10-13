export type SubscriptionPaymentEvent =
    | {
        type: 'PAYMENT_SUCCEEDED';
        externalSubscriptionReference: string;
        externalPaymentReference: string;
        amount: string;
        currencyCode: string;
        paidAt: Date;
    }
    | {
        type: 'SUBSCRIPTION_CANCELED';
        externalSubscriptionReference: string;
    };