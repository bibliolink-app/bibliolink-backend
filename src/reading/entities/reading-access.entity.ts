import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn, } from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity({ name: 'reading_accesses' })
export class ReadingAccess {
    @PrimaryGeneratedColumn({ name: 'reading_access_id', type: 'int', unsigned: true, })
    readingAccessId!: number;

    @Column({ name: 'user_id', type: 'int', unsigned: true, unique: true, })
    userId!: number;

    @Column({ name: 'expires_at', type: 'datetime', precision: 3, })
    expiresAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)', onUpdate: 'CURRENT_TIMESTAMP(3)', })
    updatedAt!: Date;

    @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'user_id' })
    user!: User;
}