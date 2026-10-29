import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, } from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';
import { CATEGORY_BOOKS_DEFAULT_PAGE_SIZE, CATEGORY_BOOKS_MAX_PAGE_SIZE, } from '../constants/categories.constants';

// Parámetros de paginación de `GET /categories/:code/books`.
export class FindCategoryBooksDto {
    @Type(() => Number)
    @IsOptional()
    @IsInt(localizedValidation('VALIDATION_PAGE_INTEGER'))
    @Min(1, localizedValidation('VALIDATION_PAGE_MIN', { min: 1 }))
    page: number = 1;

    @Type(() => Number)
    @IsOptional()
    @IsInt(localizedValidation('VALIDATION_PAGE_SIZE_INTEGER'))
    @Min(1, localizedValidation('VALIDATION_PAGE_SIZE_MIN', { min: 1 }))
    @Max(
        CATEGORY_BOOKS_MAX_PAGE_SIZE,
        localizedValidation('VALIDATION_PAGE_SIZE_MAX', { max: CATEGORY_BOOKS_MAX_PAGE_SIZE }),
    )
    pageSize: number = CATEGORY_BOOKS_DEFAULT_PAGE_SIZE;
}
