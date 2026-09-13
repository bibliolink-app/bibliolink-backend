import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Subscription } from "../Subscription/subscription.entity.js";

@Entity('payment')
export class Payment {
    @PrimaryGeneratedColumn({ name: 'payment_id' })
    paymentId: number;

    // a subscription can have many payments
    // a payment belongs to one subscription
    // @ManyToOne(() => Subscription, (subscription) => subscription.payments, { nullable: false })
    // @JoinColumn({ name: 'subscription_id' })
    // subscription: Subscription;

    @Column({ name: 'provider', type: 'varchar' })
    provider: string;

    @Column({ name: 'external_reference', type: 'varchar'})
    externalReference: string;

    @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ name: 'payment_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    paymentDate: Date;

    @Column({ name: 'payment_status', type: 'varchar' })
    paymentStatus: string;
}