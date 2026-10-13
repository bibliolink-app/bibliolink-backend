import { BookDetailResponseDto } from '../../books/dto/book-detail-response.dto';
import { BookCategoryCode } from '../../catalogs/enums/book-category-code.enum';

// Respuesta de `GET /categories/:code/books`: una página de obras guardadas
// que pertenecen a la categoría.
export class CategoryBooksResponseDto {
    category!: {
        code: BookCategoryCode;
        name: string;
    };

    page!: number;

    pageSize!: number;

    totalItems!: number;

    hasNextPage!: boolean;

    items!: BookDetailResponseDto[];
}
