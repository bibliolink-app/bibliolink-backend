import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Favorite } from "../Favorites/favorite.entity.js";

@Entity('book')
export class Book {
    @PrimaryGeneratedColumn({ name: 'book_id' })
    bookId: number;

    @Column({ name: 'book_provider', type: 'varchar', length: 255 })
    bookProvider: string;

    @Column({ name: 'external_reference', type: 'varchar', length: 255 })
    externalReference: string;

    @Column({name: 'minimal_metadata', type: 'json', nullable: true})
    minimalMetadata: any;

    // a book can be favorited by many users
    // a favorite belongs to one book
    // @OneToMany(() => Favorite, (favorite) => favorite.book)
    // favorites: Favorite[];
}