import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, } from 'typeorm';

import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { PaymentTransactionStatus } from '../enums/payment-transaction-status.enum';

@Entity({ name: 'payment_transactions' })
@Unique(
    'UQ_payment_transactions_subscription_external_reference',
    ['subscriptionId', 'externalReference'],
)
export class PaymentTransaction {
    @PrimaryGeneratedColumn({ name: 'payment_transaction_id', type: 'int', unsigned: true, })
    paymentTransactionId!: number;

    @Column({ name: 'subscription_id', type: 'int', unsigned: true, })
    subscriptionId!: number;

    @Column({ name: 'external_reference', type: 'varchar', length: 255, })
    externalReference!: string;

    @Column({ type: 'enum', enum: PaymentTransactionStatus, })
    status!: PaymentTransactionStatus;

    @Column({ type: 'decimal', precision: 10, scale: 2, })
    amount!: string;

    @Column({ name: 'currency_code', type: 'char', length: 3, })
    currencyCode!: string;

    @Column({ name: 'paid_at', type: 'datetime', precision: 3, nullable: true, })
    paidAt!: Date | null;

    @CreateDateColumn({name: 'created_at',type: 'datetime',precision: 3,default: () => 'CURRENT_TIMESTAMP(3)',})
    createdAt!: Date;

    @ManyToOne(() => Subscription, { nullable: false, })
    @JoinColumn({ name: 'subscription_id' })
    subscription!: Subscription;
}