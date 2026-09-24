export interface RecordSuccessfulPayment {
    subscriptionId: number;
    externalReference: string;
    amount: string;
    currencyCode: string;
    paidAt: Date;
}