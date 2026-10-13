import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class ResetPasswordDto {
    @IsString({ message: 'El token de recuperación debe ser un texto.' })
    @IsNotEmpty({ message: 'El token de recuperación es obligatorio.' })
    @MaxLength(64, {
        message: 'El token de recuperación supera la longitud permitida.',
    })
    token!: string;

    @IsString({ message: 'La nueva contraseña debe ser un texto.' })
    @IsStrongPassword()
    newPassword!: string;
}
