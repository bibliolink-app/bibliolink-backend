import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class ResetPasswordDto {
    @IsString(localizedValidation('VALIDATION_RESET_TOKEN_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_RESET_TOKEN_REQUIRED'))
    @MaxLength(64, localizedValidation('VALIDATION_RESET_TOKEN_MAX_LENGTH'))
    token!: string;

    @IsString(localizedValidation('VALIDATION_NEW_PASSWORD_STRING'))
    @IsStrongPassword()
    newPassword!: string;
}
