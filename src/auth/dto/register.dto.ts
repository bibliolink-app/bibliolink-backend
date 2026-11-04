import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, } from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';
import { normalizeLocalDate } from '../../common/dates/local-date';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';
import { trimString } from '../../common/transformers/trim-string.transformer';

export class RegisterDto {
    @Transform(trimString)
    @IsString(localizedValidation('VALIDATION_USERNAME_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_USERNAME_REQUIRED'))
    @MaxLength(25, localizedValidation('VALIDATION_USERNAME_MAX_LENGTH', { max: 25 }))
    username!: string;

    @Transform(trimString)
    @IsString(localizedValidation('VALIDATION_FIRST_NAME_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_FIRST_NAME_REQUIRED'))
    @MaxLength(50, localizedValidation('VALIDATION_FIRST_NAME_MAX_LENGTH', { max: 50 }))
    firstName!: string;

    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_MIDDLE_NAME_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_MIDDLE_NAME_REQUIRED'))
    @MaxLength(50, localizedValidation('VALIDATION_MIDDLE_NAME_MAX_LENGTH', { max: 50 }))
    middleName?: string | null;

    @Transform(trimString)
    @IsString(localizedValidation('VALIDATION_FIRST_SURNAME_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_FIRST_SURNAME_REQUIRED'))
    @MaxLength(50, localizedValidation('VALIDATION_FIRST_SURNAME_MAX_LENGTH', { max: 50 }))
    firstSurname!: string;

    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_SECOND_SURNAME_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_SECOND_SURNAME_REQUIRED'))
    @MaxLength(50, localizedValidation('VALIDATION_SECOND_SURNAME_MAX_LENGTH', { max: 50 }))
    secondSurname?: string | null;

    @Transform(({ value }) => normalizeLocalDate(value))
    @IsString(localizedValidation('VALIDATION_BIRTH_DATE_STRING'))
    birthDate!: string;

    @Transform(trimString)
    @IsEmail({}, localizedValidation('VALIDATION_EMAIL_FORMAT'))
    @MaxLength(254, localizedValidation('VALIDATION_EMAIL_MAX_LENGTH', { max: 254 }))
    email!: string;

    @IsString(localizedValidation('VALIDATION_PASSWORD_STRING'))
    @IsStrongPassword()
    password!: string;

    @IsString(localizedValidation('VALIDATION_CAPTCHA_TOKEN_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_CAPTCHA_TOKEN_REQUIRED'))
    @MaxLength(4096, localizedValidation('VALIDATION_CAPTCHA_TOKEN_MAX_LENGTH'))
    captchaToken!: string;
}
