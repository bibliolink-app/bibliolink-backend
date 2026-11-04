import { IsNotEmpty, IsString } from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
    @IsString(localizedValidation('VALIDATION_CURRENT_PASSWORD_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_CURRENT_PASSWORD_REQUIRED'))
    currentPassword!: string;

    @IsString(localizedValidation('VALIDATION_NEW_PASSWORD_STRING'))
    @IsStrongPassword()
    newPassword!: string;
}
