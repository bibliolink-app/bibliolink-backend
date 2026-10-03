import { BookDetailResponseDto } from '../../books/dto/book-detail-response.dto';

// Un favorito del usuario, con los datos completos de la obra.
export class FavoriteResponseDto {
    favoriteId!: number;

    bookId!: number;

    progressPercent!: number;

    readingLocation!: string | null;

    addedAt!: Date;

    lastReadAt!: Date | null;

    book!: BookDetailResponseDto;
}
