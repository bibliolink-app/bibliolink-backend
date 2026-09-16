import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, } from 'typeorm';

import { Book } from './book.entity';

@Entity({ name: 'book_authors' })
export class BookAuthor {
    @PrimaryColumn({ name: 'book_id', type: 'int', unsigned: true, })
    bookId!: number;

    @PrimaryColumn({ name: 'author_order', type: 'tinyint', unsigned: true, })
    authorOrder!: number;

    @Column({ name: 'author_name', type: 'varchar', length: 255, })
    authorName!: string;

    @ManyToOne(() => Book, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'book_id' })
    book!: Book;
}