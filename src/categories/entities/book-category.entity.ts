import { Entity, JoinColumn, ManyToOne, PrimaryColumn, } from 'typeorm';

import { Book } from '../../books/entities/book.entity';
import { Category } from './category.entity';

@Entity({ name: 'book_categories' })
export class BookCategory {
    @PrimaryColumn({ name: 'book_id', type: 'int', unsigned: true, })
    bookId!: number;

    @PrimaryColumn({ name: 'category_id', type: 'smallint', unsigned: true, })
    categoryId!: number;

    @ManyToOne(() => Book, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'book_id' })
    book!: Book;

    @ManyToOne(() => Category, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'category_id' })
    category!: Category;
}