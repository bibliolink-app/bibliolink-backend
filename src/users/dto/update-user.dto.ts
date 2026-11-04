import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';
import { normalizeLocalDate } from '../../common/dates/local-date';
import { trimString } from '../../common/transformers/trim-string.transformer';

export class UpdateUserDto {
    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_USERNAME_STRING'))
    @MaxLength(25, localizedValidation('VALIDATION_USERNAME_MAX_LENGTH', { max: 25 }))
    username?: string;

    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_FIRST_NAME_STRING'))
    @MaxLength(50, localizedValidation('VALIDATION_FIRST_NAME_MAX_LENGTH', { max: 50 }))
    firstName?: string;

    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_MIDDLE_NAME_STRING'))
    @MaxLength(50, localizedValidation('VALIDATION_MIDDLE_NAME_MAX_LENGTH', { max: 50 }))
    middleName?: string | null;

    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_FIRST_SURNAME_STRING'))
    @MaxLength(50, localizedValidation('VALIDATION_FIRST_SURNAME_MAX_LENGTH', { max: 50 }))
    firstSurname?: string;

    @Transform(trimString)
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_SECOND_SURNAME_STRING'))
    @MaxLength(50, localizedValidation('VALIDATION_SECOND_SURNAME_MAX_LENGTH', { max: 50 }))
    secondSurname?: string | null;

    @Transform(({ value }) => normalizeLocalDate(value))
    @IsOptional()
    @IsString(localizedValidation('VALIDATION_BIRTH_DATE_STRING'))
    birthDate?: string;

    @Transform(trimString)
    @IsOptional()
    @IsEmail({}, localizedValidation('VALIDATION_EMAIL_FORMAT'))
    @MaxLength(254, localizedValidation('VALIDATION_EMAIL_MAX_LENGTH', { max: 254 }))
    email?: string;
}
