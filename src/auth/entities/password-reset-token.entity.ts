import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, } from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity({ name: 'password_reset_tokens' })
export class PasswordResetToken {
    @PrimaryGeneratedColumn({ name: 'password_reset_token_id', type: 'int', unsigned: true, })
    passwordResetTokenId!: number;

    @Column({ name: 'user_id', type: 'int', unsigned: true, })
    userId!: number;

    @Column({ name: 'token_hash', type: 'char', length: 64, unique: true, })
    tokenHash!: string;

    @Column({ name: 'expires_at', type: 'datetime', precision: 3, })
    expiresAt!: Date;

    @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true, })
    usedAt!: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3,  default: () => 'CURRENT_TIMESTAMP(3)', })
    createdAt!: Date;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'user_id' })
    user!: User;
}