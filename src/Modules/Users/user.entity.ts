import { Column, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Favorite } from "../Favorites/favorite.entity.js";
import { Subscription } from "../Subscription/subscription.entity.js";

@Entity('user')
export class User {
    @PrimaryGeneratedColumn({ name: 'user_id' })
    userId: number;

    @Column({ name: 'user_name', type: 'varchar', unique: true })
    userName: string;

    @Column({ name: 'first_name', type: 'varchar' })
    name: string;

    @Column({ name: 'second_name', type: 'varchar', nullable: true })
    secondName?: string | null;

    @Column({ name: 'first_last_name', type: 'varchar' })
    firstLastName: string;

    @Column({ name: 'second_last_name', type: 'varchar', nullable: true })
    secondLastName?: string | null;

    @Column({ name: 'email', type: 'varchar', unique: true })
    email: string;

    @Column({ name: 'password', type: 'varchar' })
    password: string;

    @Column({ name: 'birth_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    birthDate: Date;

    @Column({ name: 'status', type: 'boolean', default: true })
    status: boolean;

    // a user has many favorites
    // a favorite belongs to one user
    // @OneToMany(() => Favorite, (favorite) => favorite.user)
    // favorites: Favorite[];

    // a user has one subscription
    // a subscription belongs to one user
    // @OneToOne(() => Subscription, (subscription) => subscription.user)
    // subscription: Subscription;
}