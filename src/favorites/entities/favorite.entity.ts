import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, } from 'typeorm';

import { Book } from '../../books/entities/book.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'favorites' })
@Unique('UQ_favorites_user_book', ['userId', 'bookId'])
export class Favorite {
    @PrimaryGeneratedColumn({ name: 'favorite_id', type: 'int', unsigned: true, })
    favoriteId!: number;

    @Column({ name: 'user_id', type: 'int', unsigned: true, })
    userId!: number;

    @Column({ name: 'book_id', type: 'int', unsigned: true, })
    bookId!: number;

    @Column({ name: 'progress_percent', type: 'decimal', precision: 5, scale: 2, default: 0, })
    progressPercent!: string;

    @Column({ name: 'reading_location', type: 'varchar', length: 1000, nullable: true, })
    readingLocation!: string | null;

    @Column({ name: 'added_at', type: 'datetime', precision: 3, })
    addedAt!: Date;

    @Column({ name: 'last_read_at', type: 'datetime', precision: 3, nullable: true, })
    lastReadAt!: Date | null;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @ManyToOne(() => Book, { nullable: false, onDelete: 'CASCADE', })
    @JoinColumn({ name: 'book_id' })
    book!: Book;
}