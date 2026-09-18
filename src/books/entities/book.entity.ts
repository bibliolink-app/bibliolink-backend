import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn, } from 'typeorm';

import { BookProvider } from '../../catalogs/entities/book-provider.entity';

@Entity({ name: 'books' })
@Unique('UQ_books_provider_external_reference', ['providerId', 'externalReference'])
export class Book {
    @PrimaryGeneratedColumn({ name: 'book_id', type: 'int', unsigned: true, })
    bookId!: number;

    @Column({ name: 'provider_id', type: 'smallint', unsigned: true, })
    providerId!: number;

    @Column({ name: 'external_reference', type: 'varchar', length: 255, })
    externalReference!: string;

    @Column({ type: 'varchar', length: 500, })
    title!: string;

    @Column({ type: 'text', nullable: true, })
    description!: string | null;

    @Column({ name: 'cover_url', type: 'varchar', length: 2048, nullable: true, })
    coverUrl!: string | null;

    @Column({ name: 'content_reference', type: 'varchar', length: 2048, nullable: true, })
    contentReference!: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3,  default: () => 'CURRENT_TIMESTAMP(3)',})
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3,  default: () => 'CURRENT_TIMESTAMP(3)', onUpdate: 'CURRENT_TIMESTAMP(3)', })
    updatedAt!: Date;

    @ManyToOne(() => BookProvider, { nullable: false, })
    @JoinColumn({ name: 'provider_id' })
    provider!: BookProvider;
}