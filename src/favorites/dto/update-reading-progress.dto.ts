import { Transform, Type } from 'class-transformer';
import { IsDefined, IsNumber, IsString, Max, MaxLength, Min, ValidateIf, } from 'class-validator';

import { MAX_PROGRESS_PERCENT, MIN_PROGRESS_PERCENT, READING_LOCATION_MAX_LENGTH, } from '../constants/favorites.constants';

import { trimNullableString } from '../../common/transformers/trim-nullable-string.transform';

export class UpdateReadingProgressDto {
    @Type(() => Number)
    @IsNumber(
        { allowNaN: false, allowInfinity: false },
        { message: 'El progreso debe ser un número.' },
    )
    @Min(MIN_PROGRESS_PERCENT, { message: `El progreso no puede ser menor que ${MIN_PROGRESS_PERCENT}.` })
    @Max(MAX_PROGRESS_PERCENT, { message: `El progreso no puede ser mayor que ${MAX_PROGRESS_PERCENT}.` })
    progressPercent!: number;

    // Cada actualización reemplaza la posición anterior.
    // Una cadena vacía se normaliza a null; el campo no puede omitirse.
    @Transform(trimNullableString)
    @IsDefined({ message: 'La posición de lectura es obligatoria.', })
    @ValidateIf((_, value) => value !== null)
    @IsString({ message: 'La posición de lectura debe ser un texto.', })
    @MaxLength(READING_LOCATION_MAX_LENGTH, { message: `La posición de lectura no puede superar los ${READING_LOCATION_MAX_LENGTH} caracteres.`, })
    readingLocation!: string | null;
}
