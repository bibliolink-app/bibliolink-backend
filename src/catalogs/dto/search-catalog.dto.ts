import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, } from 'class-validator';

import { trimString } from '../../common/transformers/trim-string.transformer';
import { CATALOG_DEFAULT_PAGE_SIZE, CATALOG_MAX_PAGE_SIZE, } from '../constants/catalogs.constants';
import { BookProviderCode } from '../enums/book-provider-code.enum';

// Parámetros aceptados al buscar obras en los proveedores externos.
export class SearchCatalogDto {
    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El término de búsqueda debe ser un texto.' })
    @MaxLength(200, {
        message: 'El término de búsqueda no puede superar los 200 caracteres.',
    })
    query?: string;

    // Cuando se omite, la búsqueda consulta a todos los proveedores activos.
    @Transform(trimString)
    @IsOptional()
    @IsEnum(BookProviderCode, {
        message: 'El proveedor indicado no está soportado.',
    })
    provider?: BookProviderCode;

    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El idioma debe ser un texto.' })
    @MaxLength(10, {
        message: 'El idioma no puede superar los 10 caracteres.',
    })
    language?: string;

    @Type(() => Number)
    @IsOptional()
    @IsInt({ message: 'La página debe ser un número entero.' })
    @Min(1, { message: 'La página debe ser mayor o igual a 1.' })
    page: number = 1;

    @Type(() => Number)
    @IsOptional()
    @IsInt({ message: 'El tamaño de página debe ser un número entero.' })
    @Min(1, { message: 'El tamaño de página debe ser mayor o igual a 1.' })
    @Max(CATALOG_MAX_PAGE_SIZE, {
        message: `El tamaño de página no puede superar ${CATALOG_MAX_PAGE_SIZE}.`,
    })
    pageSize: number = CATALOG_DEFAULT_PAGE_SIZE;
}
