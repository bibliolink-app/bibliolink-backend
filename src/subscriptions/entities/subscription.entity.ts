import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

@Entity({ name: 'subscriptions' })
export class Subscription {
    @PrimaryGeneratedColumn({ name: 'subscription_id', type: 'int', unsigned: true, })
    subscriptionId!: number;

    @Column({ name: 'user_id', type: 'int', unsigned: true, })
    userId!: number;

    @Column({ name: 'external_subscription_reference', type: 'varchar', length: 255, unique: true, nullable: true, })
    externalSubscriptionReference!: string | null;

    @Column({ type: 'enum', enum: SubscriptionStatus, })
    status!: SubscriptionStatus;

    @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true, })
    startedAt!: Date | null;

    @Column({ name: 'current_period_start', type: 'datetime', precision: 3, nullable: true, })
    currentPeriodStart!: Date | null;

    @Column({ name: 'current_period_end', type: 'datetime', precision: 3, nullable: true, })
    currentPeriodEnd!: Date | null;

    @Column({ name: 'canceled_at', type: 'datetime', precision: 3, nullable: true, })
    canceledAt!: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)', })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)', onUpdate: 'CURRENT_TIMESTAMP(3)', })
    updatedAt!: Date;

    @ManyToOne(() => User, { nullable: false, })
    @JoinColumn({ name: 'user_id' })
    user!: User;
}