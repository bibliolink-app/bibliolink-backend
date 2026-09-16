import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, } from 'typeorm';

import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Entity({ name: 'payments' })
@Unique('UQ_payments_subscription_external_reference', ['subscriptionId', 'externalReference'])
export class Payment {
    @PrimaryGeneratedColumn({ name: 'payment_id', type: 'int', unsigned: true, })
    paymentId!: number;

    @Column({ name: 'subscription_id', type: 'int', unsigned: true, })
    subscriptionId!: number;

    @Column({ name: 'external_reference', type: 'varchar', length: 255, })
    externalReference!: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, })
    amount!: string;

    @Column({ name: 'currency_code', type: 'char', length: 3, })
    currencyCode!: string;


    @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3, })
    createdAt!: Date;

    @Column({ name: 'paid_at', type: 'datetime', precision: 3, })
    paidAt!: Date;

    @ManyToOne(() => Subscription, { nullable: false, })
    @JoinColumn({ name: 'subscription_id' })
    subscription!: Subscription;
}