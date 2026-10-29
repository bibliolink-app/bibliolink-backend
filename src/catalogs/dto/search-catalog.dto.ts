import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, } from 'class-validator';

import { trimString } from '../../common/transformers/trim-string.transformer';
import { localizedValidation } from '../../i18n/localized-validation';
import { CATALOG_DEFAULT_PAGE_SIZE, CATALOG_MAX_PAGE_SIZE, } from '../constants/catalogs.constants';
import { BookProviderCode } from '../enums/book-provider-code.enum';

// Parámetros aceptados al buscar obras en los proveedores externos.
export class SearchCatalogDto {
    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_SEARCH_QUERY_STRING'))
    @MaxLength(200, localizedValidation('VALIDATION_SEARCH_QUERY_MAX_LENGTH', { max: 200 }))
    query?: string;

    // Cuando se omite, la búsqueda consulta a todos los proveedores activos.
    @Transform(trimString)
    @IsOptional()
    @IsEnum(BookProviderCode, localizedValidation('VALIDATION_PROVIDER_INVALID'))
    provider?: BookProviderCode;

    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_LANGUAGE_STRING'))
    @MaxLength(10, localizedValidation('VALIDATION_LANGUAGE_MAX_LENGTH', { max: 10 }))
    language?: string;

    @Type(() => Number)
    @IsOptional()
    @IsInt(localizedValidation('VALIDATION_PAGE_INTEGER'))
    @Min(1, localizedValidation('VALIDATION_PAGE_MIN', { min: 1 }))
    page: number = 1;

    @Type(() => Number)
    @IsOptional()
    @IsInt(localizedValidation('VALIDATION_PAGE_SIZE_INTEGER'))
    @Min(1, localizedValidation('VALIDATION_PAGE_SIZE_MIN', { min: 1 }))
    @Max(CATALOG_MAX_PAGE_SIZE, localizedValidation('VALIDATION_PAGE_SIZE_MAX', { max: CATALOG_MAX_PAGE_SIZE }))
    pageSize: number = CATALOG_DEFAULT_PAGE_SIZE;
}
