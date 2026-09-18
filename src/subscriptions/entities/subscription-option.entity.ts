import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, } from 'typeorm';

import { PaymentMethod } from '../enums/payment-method.enum';

@Entity({ name: 'subscription_options' })
export class SubscriptionOption {
    @PrimaryGeneratedColumn({ name: 'subscription_option_id', type: 'smallint', unsigned: true, })
    subscriptionOptionId!: number;

    @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, })
    paymentMethod!: PaymentMethod;

    @Column({ name: 'currency_code', type: 'char', length: 3, })
    currencyCode!: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, })
    amount!: string;

    @Column({ name: 'provider_plan_reference', type: 'varchar', length: 255, unique: true, nullable: true, })
    providerPlanReference!: string | null;

    @Column({ type: 'boolean', default: true, })
    active!: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3,  default: () => 'CURRENT_TIMESTAMP(3)',})
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3,  default: () => 'CURRENT_TIMESTAMP(3)', onUpdate: 'CURRENT_TIMESTAMP(3)',})
    updatedAt!: Date;
}