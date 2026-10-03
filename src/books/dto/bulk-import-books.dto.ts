import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, } from 'class-validator';

import { CATALOG_MAX_PAGE_SIZE } from '../../catalogs/constants/catalogs.constants';
import { trimString } from '../../common/transformers/trim-string.transformer';
import { BOOKS_BULK_IMPORT_HARD_MAX_PAGES } from '../constants/books.constants';

// Parámetros opcionales de una carga masiva. Sin `query`, cada proveedor que
// lo admita (Gutendex, Standard Ebooks, OpenAlex) recorre su catálogo
// completo desde el principio; arXiv exige un término de búsqueda y sin él
// no devuelve nada, ya que su API no ofrece un listado completo.
export class BulkImportBooksDto {
    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El término de búsqueda debe ser un texto.' })
    @MaxLength(200, {
        message: 'El término de búsqueda no puede superar los 200 caracteres.',
    })
    query?: string;

    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El idioma debe ser un texto.' })
    @MaxLength(10, {
        message: 'El idioma no puede superar los 10 caracteres.',
    })
    language?: string;

    @Type(() => Number)
    @IsOptional()
    @IsInt({ message: 'El tamaño de página debe ser un número entero.' })
    @Min(1, { message: 'El tamaño de página debe ser mayor o igual a 1.' })
    @Max(CATALOG_MAX_PAGE_SIZE, {
        message: `El tamaño de página no puede superar ${CATALOG_MAX_PAGE_SIZE}.`,
    })
    pageSize?: number;

    // Cuántas páginas recorrer como máximo antes de detenerse, aunque el
    // proveedor todavía tenga más resultados.
    @Type(() => Number)
    @IsOptional()
    @IsInt({ message: 'El límite de páginas debe ser un número entero.' })
    @Min(1, { message: 'El límite de páginas debe ser mayor o igual a 1.' })
    @Max(BOOKS_BULK_IMPORT_HARD_MAX_PAGES, {
        message: `El límite de páginas no puede superar ${BOOKS_BULK_IMPORT_HARD_MAX_PAGES}.`,
    })
    maxPages?: number;
}
