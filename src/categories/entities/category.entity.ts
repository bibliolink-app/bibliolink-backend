import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity({ name: 'categories' })
export class Category {
    @PrimaryGeneratedColumn({ name: 'category_id', type: 'smallint', unsigned: true, })
    categoryId!: number;
    @Column({ type: 'varchar', length: 150, unique: true, })
    name!: string;
}