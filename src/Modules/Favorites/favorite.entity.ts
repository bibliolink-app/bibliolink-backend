import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../Users/user.entity.js";
import { Book } from "../Books/book.entity.js";

@Entity('favorite')
export class Favorite {
    @PrimaryGeneratedColumn({ name: 'favorite_id' })
    favoriteId: number;

    // a user can have many favorites
    // a favorite belongs to one user
    // @ManyToOne(() => User, (user) => user.favorites, { nullable: false })
    // @JoinColumn({ name: 'user_id' })
    // user: User;

    // a book can be favorited by many users
    // a favorite belongs to one book
    // @ManyToOne(() => Book, (book) => book.favorites, { nullable: false })
    // @JoinColumn({ name: 'book_id' })
    // book: Book;

    @Column({ name: 'added_date', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    addedDate: Date;

    @Column({ name: 'last_accessed', type: 'timestamp', nullable: true })
    lastAccessed: Date;

    @Column({ name: 'progress', type: 'decimal', precision: 5, scale: 2, default: 0 })
    progress: number;

    @Column({ name: 'reading_position', type: 'int', default: 0 })
    readingPosition: number;
}