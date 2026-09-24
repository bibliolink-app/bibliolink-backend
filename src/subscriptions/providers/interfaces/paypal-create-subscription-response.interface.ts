export interface PayPalSubscriptionLink {
    href: string;
    rel: string;
    method?: string;
}

export interface PayPalCreateSubscriptionResponse {
    id: string;
    links: PayPalSubscriptionLink[];
}