export interface SubscriptionActivatedEvent {
    userId: number;
    subscriptionId: number;
    currentPeriodEnd: Date;
}

export interface SubscriptionCanceledEvent {
    userId: number;
    subscriptionId: number;
    currentPeriodEnd: Date | null;
}

export interface SubscriptionActivatedStreamEvent {
    kind: 'SUBSCRIPTION_ACTIVATED';

    data: {
        subscriptionId: number;
        currentPeriodEnd: Date;
    };
}


export interface SubscriptionCanceledStreamEvent {
    kind: 'SUBSCRIPTION_CANCELED';

    data: {
        subscriptionId: number;
        currentPeriodEnd: Date | null;
    };
}

export interface SseHeartbeatEvent {
    kind: 'HEARTBEAT';
}

export type SubscriptionStreamEvent =
    | SubscriptionActivatedStreamEvent
    | SubscriptionCanceledStreamEvent
    | SseHeartbeatEvent;