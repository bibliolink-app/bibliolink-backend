import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, } from 'class-validator';

import { MAX_PROGRESS_PERCENT, MIN_PROGRESS_PERCENT, READING_LOCATION_MAX_LENGTH, } from '../constants/favorites.constants';

export class UpdateReadingProgressDto {
    @Type(() => Number)
    @IsNumber(
        { allowNaN: false, allowInfinity: false },
        { message: 'El progreso debe ser un número.' },
    )
    @Min(MIN_PROGRESS_PERCENT, { message: `El progreso no puede ser menor que ${MIN_PROGRESS_PERCENT}.` })
    @Max(MAX_PROGRESS_PERCENT, { message: `El progreso no puede ser mayor que ${MAX_PROGRESS_PERCENT}.` })
    progressPercent!: number;

    // Si se omite o llega vacío se guarda `null`: cada actualización
    // reemplaza la posición anterior.
    @Transform(({ value }) => {
        if (typeof value !== 'string') {
            return value;
        }

        const trimmed = value.trim();

        return trimmed.length === 0 ? null : trimmed;
    })
    @IsOptional()
    @IsString({ message: 'La posición de lectura debe ser un texto.' })
    @MaxLength(READING_LOCATION_MAX_LENGTH, {
        message: `La posición de lectura no puede superar los ${READING_LOCATION_MAX_LENGTH} caracteres.`,
    })
    readingLocation?: string | null;
}
