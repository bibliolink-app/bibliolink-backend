export interface ConfirmedSubscriptionPayment {
    externalSubscriptionReference: string;
    externalPaymentReference: string;
    amount: string;
    currencyCode: string;
    paidAt: Date;
    periodStart: Date;
    periodEnd: Date;
}