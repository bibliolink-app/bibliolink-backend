import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Payment } from "../Payment/payment.entity.js";
import { User } from "../Users/user.entity.js";

@Entity('subscription')
export class Subscription {
    @PrimaryGeneratedColumn({ name: 'subscription_id' })
    subscriptionId: number;

    // a subscription can have many payments
    // a payment belongs to one subscription
    // @OneToMany(() => Payment, (payment) => payment.subscription)
    // payments: Payment[];

    // a subscription belongs to one user
    // a user has one subscription
    // @OneToOne(() => User, (user) => user.subscription, { nullable: false })
    // @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
    // user: User;

    @Column({ name: 'start_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    startDate: Date;

    @Column({ name: 'end_date', type: 'timestamp', nullable: true })
    endDate?: Date | null;

    @Column({ name: 'suscription_status', type: 'varchar' })
    suscriptionStatus: string;
}