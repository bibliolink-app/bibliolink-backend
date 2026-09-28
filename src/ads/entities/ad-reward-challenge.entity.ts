import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, } from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity({ name: 'ad_reward_challenges' })
@Index('IDX_ad_reward_challenges_user_id', ['userId'])
export class AdRewardChallenge {
    @PrimaryGeneratedColumn({ name: 'ad_reward_challenge_id', type: 'int', unsigned: true, })
    adRewardChallengeId!: number;

    @Column({ name: 'user_id', type: 'int', unsigned: true, unique: true })
    userId!: number;

    @Column({ name: 'token_hash', type: 'char', length: 64, unique: true, })
    tokenHash!: string;

    @Column({ name: 'expires_at', type: 'datetime', precision: 3, })
    expiresAt!: Date;

    @Column({ name: 'consumed_at', type: 'datetime', precision: 3, nullable: true, })
    consumedAt!: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)', })
    createdAt!: Date;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'user_id' })
    user!: User;
}