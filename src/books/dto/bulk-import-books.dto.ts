import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, } from 'class-validator';

import { CATALOG_MAX_PAGE_SIZE } from '../../catalogs/constants/catalogs.constants';
import { trimString } from '../../common/transformers/trim-string.transformer';
import { localizedValidation } from '../../i18n/localized-validation';
import { BOOKS_BULK_IMPORT_HARD_MAX_PAGES } from '../constants/books.constants';

// Parámetros opcionales de una carga masiva. Sin `query`, cada proveedor que
// lo admita (Gutendex, Standard Ebooks, OpenAlex) recorre su catálogo
// completo desde el principio; arXiv exige un término de búsqueda y sin él
// no devuelve nada, ya que su API no ofrece un listado completo.
export class BulkImportBooksDto {
    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_SEARCH_QUERY_STRING'))
    @MaxLength(200, localizedValidation('VALIDATION_SEARCH_QUERY_MAX_LENGTH', { max: 200 }))
    query?: string;

    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_LANGUAGE_STRING'))
    @MaxLength(10, localizedValidation('VALIDATION_LANGUAGE_MAX_LENGTH', { max: 10 }))
    language?: string;

    @Type(() => Number)
    @IsOptional()
    @IsInt(localizedValidation('VALIDATION_PAGE_SIZE_INTEGER'))
    @Min(1, localizedValidation('VALIDATION_PAGE_SIZE_MIN', { min: 1 }))
    @Max(CATALOG_MAX_PAGE_SIZE, localizedValidation('VALIDATION_PAGE_SIZE_MAX', { max: CATALOG_MAX_PAGE_SIZE }))
    pageSize?: number;

    // Cuántas páginas recorrer como máximo antes de detenerse, aunque el
    // proveedor todavía tenga más resultados.
    @Type(() => Number)
    @IsOptional()
    @IsInt(localizedValidation('VALIDATION_MAX_PAGES_INTEGER'))
    @Min(1, localizedValidation('VALIDATION_MAX_PAGES_MIN', { min: 1 }))
    @Max(
        BOOKS_BULK_IMPORT_HARD_MAX_PAGES,
        localizedValidation('VALIDATION_MAX_PAGES_MAX', { max: BOOKS_BULK_IMPORT_HARD_MAX_PAGES }),
    )
    maxPages?: number;
}
