import { BookProviderCode } from '../../catalogs/enums/book-provider-code.enum';
import { BookCategoryResponseDto } from './book-category-response.dto';
import { BookLanguageResponseDto } from './book-language-response.dto';

// Representación completa de una obra guardada en `books`, con sus autores
// y sus idiomas ya resueltos.
export class BookDetailResponseDto {
    bookId!: number;

    providerId!: number;

    providerCode!: BookProviderCode;

    externalReference!: string;

    title!: string;

    description!: string | null;

    coverUrl!: string | null;


    // Autores en el orden en que los publicó el proveedor.
    authors!: string[];

    languages!: BookLanguageResponseDto[];

    // Categorías de la obra en la taxonomía de BiblioLink, ordenadas por nombre.
    categories!: BookCategoryResponseDto[];

    createdAt!: Date;

    updatedAt!: Date;
}
