export interface PayPalWebhookVerificationInput {
    webhookId: string;
    rawBody: Buffer;
    headers: {
        authAlgo: string;
        certUrl: string;
        transmissionId: string;
        transmissionSignature: string;
        transmissionTime: string;
    };
}

export interface PayPalWebhookVerificationResponse {
    verification_status: 'SUCCESS' | 'FAILURE';
}