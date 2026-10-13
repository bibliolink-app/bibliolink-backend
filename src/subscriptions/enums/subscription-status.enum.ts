export enum SubscriptionStatus {
    //todavía no confirmado
    PENDING = 'PENDING',
    //Premium vigente
    ACTIVE = 'ACTIVE',
    //hubo problema con un cobro/reintento
    PAST_DUE = 'PAST_DUE',
    //suscripción cancelada
    CANCELED = 'CANCELED',
    //ya terminó su vigencia
    EXPIRED = 'EXPIRED',
}
