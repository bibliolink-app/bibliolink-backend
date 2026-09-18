import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, } from 'class-validator';

import { normalizeLocalDate } from '../../common/dates/local-date';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';
import { trimString } from '../../common/transformers/trim-string.transformer';

export class CreateAdminDto {
    @Transform(trimString)
    @IsString({ message: 'El nombre de usuario debe ser un texto.' })
    @IsNotEmpty({ message: 'El nombre de usuario es obligatorio.' })
    @MaxLength(25, {
        message: 'El nombre de usuario no puede superar los 25 caracteres.',
    })
    username!: string;

    @Transform(trimString)
    @IsString({ message: 'El primer nombre debe ser un texto.' })
    @IsNotEmpty({ message: 'El primer nombre es obligatorio.' })
    @MaxLength(50, {
        message: 'El primer nombre no puede superar los 50 caracteres.',
    })
    firstName!: string;

    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El segundo nombre debe ser un texto.' })
    @IsNotEmpty({ message: 'El segundo nombre no puede estar vacío.' })
    @MaxLength(50)
    middleName?: string | null;

    @Transform(trimString)
    @IsString({ message: 'El primer apellido debe ser un texto.' })
    @IsNotEmpty({ message: 'El primer apellido es obligatorio.' })
    @MaxLength(50)
    firstSurname!: string;

    @Transform(trimString)
    @IsOptional()
    @IsString({ message: 'El segundo apellido debe ser un texto.' })
    @IsNotEmpty({ message: 'El segundo apellido no puede estar vacío.' })
    @MaxLength(50)
    secondSurname?: string | null;

    @Transform(({ value }) => normalizeLocalDate(value))
    @IsString({
        message: 'La fecha de nacimiento debe ser un texto.',
    })
    birthDate!: string;

    @Transform(trimString)
    @IsEmail({}, {
        message: 'El correo electrónico debe tener un formato válido.',
    })
    @MaxLength(254)
    email!: string;

    @IsString({ message: 'La contraseña debe ser un texto.' })
    @IsStrongPassword()
    password!: string;
}