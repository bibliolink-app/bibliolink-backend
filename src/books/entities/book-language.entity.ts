import { Entity, JoinColumn, ManyToOne, PrimaryColumn, } from 'typeorm';

import { Book } from './book.entity';
import { Language } from './language.entity';

@Entity({ name: 'book_languages' })
export class BookLanguage {
    @PrimaryColumn({ name: 'book_id', type: 'int', unsigned: true, })
    bookId!: number;

    @PrimaryColumn({ name: 'language_code', type: 'varchar', length: 10, })
    languageCode!: string;

    @ManyToOne(() => Book, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'book_id' })
    book!: Book;

    @ManyToOne(() => Language, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'language_code' })
    language!: Language;
}