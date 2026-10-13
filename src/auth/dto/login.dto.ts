import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { trimString } from '../../common/transformers/trim-string.transformer';

export class LoginDto {
    @Transform(trimString)
    @IsEmail(
        {},
        { message: 'El correo electrónico debe tener un formato válido.' },
    )
    @MaxLength(254, {
        message: 'El correo electrónico no puede superar los 254 caracteres.',
    })
    email!: string;

    @IsString({ message: 'La contraseña debe ser un texto.' })
    @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
    password!: string;
}
