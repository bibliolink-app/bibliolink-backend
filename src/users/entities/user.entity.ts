import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, } from 'typeorm';

import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

@Entity({ name: 'users' })
export class User {
    @PrimaryGeneratedColumn({ name: 'user_id', type: 'int', unsigned: true,})
    userId!: number;

    /*@OneToMany(() => Favorite, (favorite) => favorite.user)
favorites!: Favorite[];

@OneToMany(() => Subscription, (subscription) => subscription.user)
subscriptions!: Subscription[];

@OneToMany(() => PasswordResetToken, (token) => token.user)
passwordResetTokens!: PasswordResetToken[];*/

    @Column({ type: 'varchar', length: 25, unique: true, })
    username!: string;

    @Column({name: 'first_name',type: 'varchar',length: 50,})
    firstName!: string;

    @Column({ name: 'middle_name', type: 'varchar', length: 50, nullable: true,})
    middleName!: string | null;

    @Column({ name: 'first_surname', type: 'varchar', length: 50, })
    firstSurname!: string;

    @Column({ name: 'second_surname', type: 'varchar', length: 50, nullable: true, })
    secondSurname!: string | null;

    @Column({ name: 'birth_date', type: 'date', })
    birthDate!: string;

    @Column({ type: 'varchar', length: 254, unique: true, })
    email!: string;

    @Column({ name: 'password_hash', type: 'varchar', length: 255, })
    passwordHash!: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER, })
    role!: UserRole;

    @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE, })
    status!: UserStatus;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3, })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3, })
    updatedAt!: Date;
}