export interface PayPalSubscriptionDetailsResponse {
    id: string;
    plan_id: string;
    custom_id?: string;
    status: string;

    billing_info?: {
        last_payment?: {
            time: string;
        };

        next_billing_time?: string;
    };
}