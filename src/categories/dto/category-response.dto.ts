import { BookCategoryCode } from '../../catalogs/enums/book-category-code.enum';

// Una categoría tal como la ven los clientes, con cuántas obras tiene.
export class CategoryResponseDto {
    categoryId!: number;

    // Identificador estable para filtrar (`GET /categories/:code/books`).
    code!: BookCategoryCode;

    name!: string;

    bookCount!: number;
}
