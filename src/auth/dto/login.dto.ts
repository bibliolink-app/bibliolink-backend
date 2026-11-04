import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';
import { trimString } from '../../common/transformers/trim-string.transformer';

export class LoginDto {
    @Transform(trimString)
    @IsEmail(
        {},
        localizedValidation('VALIDATION_EMAIL_FORMAT'),
    )
    @MaxLength(254, localizedValidation('VALIDATION_EMAIL_MAX_LENGTH', { max: 254 }))
    email!: string;

    @IsString(localizedValidation('VALIDATION_PASSWORD_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_PASSWORD_REQUIRED'))
    password!: string;
}
