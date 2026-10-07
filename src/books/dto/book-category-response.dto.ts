import { BookCategoryCode } from '../../catalogs/enums/book-category-code.enum';

// Categoría de una obra tal como se expone en las respuestas de `books`. El
// `code` es el que se usa para filtrar (`GET /categories/:code/books`).
export class BookCategoryResponseDto {
    code!: BookCategoryCode;
    name!: string;
}
