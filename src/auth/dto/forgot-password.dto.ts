import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';

import { trimString } from '../../common/transformers/trim-string.transformer';

export class ForgotPasswordDto {
    @Transform(trimString)
    @IsEmail({}, {
        message: 'El correo electrónico debe tener un formato válido.',
    })
    @MaxLength(254, {
        message: 'El correo electrónico no puede superar los 254 caracteres.',
    })
    email!: string;
}
