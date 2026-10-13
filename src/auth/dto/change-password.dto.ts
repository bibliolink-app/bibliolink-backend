import { IsNotEmpty, IsString } from 'class-validator';

import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
    @IsString({ message: 'La contraseña actual debe ser un texto.' })
    @IsNotEmpty({ message: 'La contraseña actual es obligatoria.' })
    currentPassword!: string;

    @IsString({ message: 'La nueva contraseña debe ser un texto.' })
    @IsStrongPassword()
    newPassword!: string;
}
