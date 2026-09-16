import { BadRequestException } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, ValidateBy } from 'class-validator';

import { normalizeLocalDate } from '../../common/dates/local-date';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class RegisterDto {
    @IsString()
    @Matches(/\S/u, { message: 'username no puede estar vacío ni contener solo espacios.' })
    @MaxLength(25)
    username: string;

    @IsString()
    @Matches(/\S/u, { message: 'firstName no puede estar vacío ni contener solo espacios.' })
    @MaxLength(50)
    firstName: string;

    @IsOptional()
    @IsString()
    @Matches(/\S/u, { message: 'middleName no puede estar vacío ni contener solo espacios.' })
    @MaxLength(50)
    middleName?: string | null;

    @IsString()
    @Matches(/\S/u, { message: 'firstSurname no puede estar vacío ni contener solo espacios.' })
    @MaxLength(50)
    firstSurname: string;

    @IsOptional()
    @IsString()
    @Matches(/\S/u, { message: 'secondSurname no puede estar vacío ni contener solo espacios.' })
    @MaxLength(50)
    secondSurname?: string | null;

    @IsString()
    @ValidateBy({
        name: 'isLocalDate',
        validator: {
            validate(value: unknown): boolean {
                try {
                    return normalizeLocalDate(value) === value;
                } catch (error: unknown) {
                    if (error instanceof BadRequestException) {
                        return false;
                    }
                    throw error;
                }
            },
            defaultMessage: () => 'birthDate debe ser una fecha válida con formato YYYY-MM-DD.',
        },
    })
    birthDate: string;

    @IsString()
    @IsEmail()
    @MaxLength(254)
    email: string;

    @IsStrongPassword()
    password: string;

    @IsString()
    @Matches(/\S/u, { message: 'captchaToken no puede estar vacío ni contener solo espacios.' })
    @MaxLength(4096)
    captchaToken: string;
}

