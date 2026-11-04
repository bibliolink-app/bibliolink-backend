import 'reflect-metadata';
import { Body, Controller, Get, Post, ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createValidationException } from '../../i18n/localized-validation';
import { normalizeLocalDate } from '../dates/local-date';
import { IsStrongPassword } from '../decorators/is-strong-password.decorator';
import { HttpExceptionFilter } from './http-exception.filter';

class PasswordDto {
    @IsStrongPassword()
    password!: string;
}

class DateDto {
    @Transform(({ value }) => normalizeLocalDate(value))
    @IsString()
    date!: string;
}

// Solo se registra en esta aplicación de prueba, sin módulos ni servicios externos.
@Controller('common-i18n')
class CommonMessagesController {
    @Post('password')
    password(@Body() dto: PasswordDto) {
        return { accepted: typeof dto.password === 'string' };
    }

    @Post('date')
    date(@Body() dto: DateDto) {
        return { date: dto.date };
    }

    @Get('unexpected')
    unexpected(): never {
        throw new Error('Private internal diagnostic');
    }
}

const translations = [
    {
        language: 'es',
        password: 'La contraseña debe tener al menos 8 caracteres, una letra, un número y un carácter especial, y no superar 72 bytes UTF-8.',
        string: 'La fecha debe ser una cadena de texto.',
        required: 'La fecha no puede estar vacía.',
        format: 'Fecha inválida ("31/12/2026"). El formato válido es YYYY-MM-DD.',
        invalid: 'La fecha "2025-02-29" no existe.',
        internal: 'Ha ocurrido un error inesperado.',
    },
    {
        language: 'en',
        password: 'The password must contain at least 8 characters, a letter, a number and a special character, and must not exceed 72 UTF-8 bytes.',
        string: 'The date must be a string.',
        required: 'The date cannot be empty.',
        format: 'Invalid date ("31/12/2026"). The valid format is YYYY-MM-DD.',
        invalid: 'The date "2025-02-29" does not exist.',
        internal: 'An unexpected error occurred.',
    },
    {
        language: 'fr',
        password: 'Le mot de passe doit contenir au moins 8 caractères, une lettre, un chiffre et un caractère spécial, et ne pas dépasser 72 octets UTF-8.',
        string: 'La date doit être une chaîne de caractères.',
        required: 'La date ne peut pas être vide.',
        format: 'Date invalide ("31/12/2026"). Le format valide est YYYY-MM-DD.',
        invalid: 'La date "2025-02-29" n\'existe pas.',
        internal: 'Une erreur inattendue s\'est produite.',
    },
    {
        language: 'pt',
        password: 'A senha deve conter pelo menos 8 caracteres, uma letra, um número e um caractere especial, e não ultrapassar 72 bytes UTF-8.',
        string: 'A data deve ser uma string.',
        required: 'A data não pode estar vazia.',
        format: 'Data inválida ("31/12/2026"). O formato válido é YYYY-MM-DD.',
        invalid: 'A data "2025-02-29" não existe.',
        internal: 'Ocorreu um erro inesperado.',
    },
] as const;

describe('Common messages over HTTP', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
        // Vitest no emite la metadata de parámetros que Nest recibe con tsc.
        Reflect.defineMetadata('design:paramtypes', [PasswordDto], CommonMessagesController.prototype, 'password');
        Reflect.defineMetadata('design:paramtypes', [DateDto], CommonMessagesController.prototype, 'date');
        const module = await Test.createTestingModule({ controllers: [CommonMessagesController] }).compile();
        app = module.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: createValidationException,
        }));
        app.useGlobalFilters(new HttpExceptionFilter());
        await app.init();
    });

    afterAll(async () => { await app?.close(); });

    describe.each(translations)('Accept-Language: $language', (messages) => {
        it('localizes password validation without exposing the value or changing the response shape', async () => {
            const response = await request(app.getHttpServer()).post('/common-i18n/password')
                .set('Accept-Language', messages.language).send({ password: 'private-invalid' }).expect(400);
            expect(response.body).toEqual({
                statusCode: 400,
                code: 'VALIDATION_FAILED',
                message: [messages.password],
                details: [{ field: 'password', code: 'VALIDATION_STRONG_PASSWORD', message: messages.password }],
                error: 'BAD_REQUEST',
                path: '/common-i18n/password',
                timestamp: expect.any(String),
            });
            expect(response.text).not.toContain('private-invalid');
        });

        it.each([
            { value: 20260101, code: 'VALIDATION_DATE_STRING', message: messages.string },
            { value: '   ', code: 'VALIDATION_DATE_REQUIRED', message: messages.required },
            { value: ' 31/12/2026 ', code: 'VALIDATION_DATE_FORMAT', message: messages.format },
            { value: ' 2025-02-29 ', code: 'VALIDATION_DATE_INVALID', message: messages.invalid },
        ])('preserves 400 and interpolation for $code', async ({ value, code, message }) => {
            const response = await request(app.getHttpServer()).post('/common-i18n/date')
                .set('Accept-Language', messages.language).send({ date: value }).expect(400);
            expect(response.body).toEqual({
                statusCode: 400, code, message, error: 'BAD_REQUEST',
                path: '/common-i18n/date', timestamp: expect.any(String),
            });
        });

        it.each(['2024-02-29', '2000-02-29', '2026-12-31'])('keeps valid dates unchanged: %s', async (date) => {
            await request(app.getHttpServer()).post('/common-i18n/date')
                .set('Accept-Language', messages.language).send({ date: ` ${date} ` })
                .expect(201, { date });
        });

        it.each(['1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00'])('still rejects invalid dates: %s', async (date) => {
            await request(app.getHttpServer()).post('/common-i18n/date')
                .set('Accept-Language', messages.language).send({ date }).expect(400);
        });

        it('keeps compliant passwords valid', async () => {
            await request(app.getHttpServer()).post('/common-i18n/password')
                .set('Accept-Language', messages.language).send({ password: 'ñ'.repeat(35) + '1!' })
                .expect(201, { accepted: true });
        });

        it('preserves the shared safe response for unexpected errors', async () => {
            const response = await request(app.getHttpServer()).get('/common-i18n/unexpected')
                .set('Accept-Language', messages.language).expect(500);
            expect(response.body).toEqual({
                statusCode: 500, code: 'INTERNAL_ERROR', message: messages.internal,
                error: 'INTERNAL_SERVER_ERROR', path: '/common-i18n/unexpected', timestamp: expect.any(String),
            });
        });
    });

    it.each([undefined, 'de'])('falls back to Spanish for %s', async (language) => {
        const call = request(app.getHttpServer()).post('/common-i18n/password');
        if (language) call.set('Accept-Language', language);
        const response = await call.send({ password: 'short' }).expect(400);
        expect(response.body.message).toEqual([translations[0].password]);
    });
});
