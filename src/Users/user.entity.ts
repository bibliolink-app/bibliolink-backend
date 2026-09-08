import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('user')
export class User {
    @PrimaryGeneratedColumn({ name: 'id' })
    id: number;

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
}