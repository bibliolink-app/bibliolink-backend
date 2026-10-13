import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, } from 'class-validator';

import { CATEGORY_BOOKS_DEFAULT_PAGE_SIZE, CATEGORY_BOOKS_MAX_PAGE_SIZE, } from '../constants/categories.constants';

// Parámetros de paginación de `GET /categories/:code/books`.
export class FindCategoryBooksDto {
    @Type(() => Number)
    @IsOptional()
    @IsInt({ message: 'La página debe ser un número entero.' })
    @Min(1, { message: 'La página debe ser mayor o igual a 1.' })
    page: number = 1;

    @Type(() => Number)
    @IsOptional()
    @IsInt({ message: 'El tamaño de página debe ser un número entero.' })
    @Min(1, { message: 'El tamaño de página debe ser mayor o igual a 1.' })
    @Max(CATEGORY_BOOKS_MAX_PAGE_SIZE, {
        message: `El tamaño de página no puede superar ${CATEGORY_BOOKS_MAX_PAGE_SIZE}.`,
    })
    pageSize: number = CATEGORY_BOOKS_DEFAULT_PAGE_SIZE;
}
