import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

import { normalizeLocalDate } from '../../common/dates/local-date';
import { trimString } from '../../common/transformers/trim-string.transformer';

export class UpdateUserDto {
    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El nombre de usuario debe ser un texto.' })
    @MaxLength(25, {
        message: 'El nombre de usuario no puede superar los 25 caracteres.',
    })
    username?: string;

    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El primer nombre debe ser un texto.' })
    @MaxLength(50, {
        message: 'El primer nombre no puede superar los 50 caracteres.',
    })
    firstName?: string;

    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El segundo nombre debe ser un texto.' })
    @MaxLength(50, {
        message: 'El segundo nombre no puede superar los 50 caracteres.',
    })
    middleName?: string | null;

    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El primer apellido debe ser un texto.' })
    @MaxLength(50, {
        message: 'El primer apellido no puede superar los 50 caracteres.',
    })
    firstSurname?: string;

    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El segundo apellido debe ser un texto.' })
    @MaxLength(50, {
        message: 'El segundo apellido no puede superar los 50 caracteres.',
    })
    secondSurname?: string | null;

    @Transform(({ value }) => normalizeLocalDate(value))
    @IsOptional()
    @IsString({ message: 'La fecha de nacimiento debe ser un texto.' })
    birthDate?: string;

    @Transform(trimString)
    @IsOptional()
    @IsEmail({}, {
        message: 'El correo electrónico debe tener un formato válido.',
    })
    @MaxLength(254, {
        message: 'El correo electrónico no puede superar los 254 caracteres.',
    })
    email?: string;
}