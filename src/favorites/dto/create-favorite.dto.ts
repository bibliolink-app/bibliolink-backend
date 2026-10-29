import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';

// Agrega a favoritos una obra que ya está guardada en `books`.
export class CreateFavoriteDto {
    @Type(() => Number)
    @IsInt(localizedValidation('VALIDATION_BOOK_ID_INTEGER'))
    @Min(1, localizedValidation('VALIDATION_BOOK_ID_MIN', { min: 1 }))
    bookId!: number;
}
