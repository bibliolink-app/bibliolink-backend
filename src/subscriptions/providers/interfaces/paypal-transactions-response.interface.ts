export interface PayPalTransaction {
    id: string;
    status?: string;
    time: string;
    amount_with_breakdown: {
        gross_amount: {
            currency_code: string;
            value: string;
        };
    };
}

export interface PayPalTransactionsResponse {
    transactions: PayPalTransaction[];
}