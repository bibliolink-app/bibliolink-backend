import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity({ name: 'book_providers' })
export class BookProvider {
    @PrimaryGeneratedColumn({ name: 'provider_id', type: 'smallint', unsigned: true, })
    providerId!: number;

    @Column({ type: 'varchar', length: 50, unique: true, })
    code!: string;

    @Column({ type: 'varchar', length: 100, })
    name!: string;

    @Column({ type: 'boolean', default: true, })
    active!: boolean;
}