import { Transform, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsString, Max, MaxLength, Min, ValidateIf, } from 'class-validator';

import { MAX_PROGRESS_PERCENT, MIN_PROGRESS_PERCENT, READING_LOCATION_MAX_LENGTH, } from '../constants/favorites.constants';

import { trimNullableString } from '../../common/transformers/trim-nullable-string.transform';
import { localizedValidation } from '../../i18n/localized-validation';

export class UpdateReadingProgressDto {
    @Type(() => Number)
    @IsNumber(
        { allowNaN: false, allowInfinity: false },
        localizedValidation('VALIDATION_PROGRESS_NUMBER'),
    )
    @Min(MIN_PROGRESS_PERCENT, localizedValidation('VALIDATION_PROGRESS_MIN', { min: MIN_PROGRESS_PERCENT }))
    @Max(MAX_PROGRESS_PERCENT, localizedValidation('VALIDATION_PROGRESS_MAX', { max: MAX_PROGRESS_PERCENT }))
    progressPercent!: number;

    // Cada actualización reemplaza la posición anterior.
    // Una cadena vacía se normaliza a null; el campo no puede omitirse.
    @Transform(trimNullableString)
    @IsDefined(localizedValidation('VALIDATION_READING_LOCATION_REQUIRED'))
    @ValidateIf((_, value) => value !== null)
    @IsString(localizedValidation('VALIDATION_READING_LOCATION_STRING'))
    @MaxLength(
        READING_LOCATION_MAX_LENGTH,
        localizedValidation('VALIDATION_READING_LOCATION_MAX_LENGTH', { max: READING_LOCATION_MAX_LENGTH }),
    )
    readingLocation!: string | null;
}
