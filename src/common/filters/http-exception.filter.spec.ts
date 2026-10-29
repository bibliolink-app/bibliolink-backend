import { BadRequestException, ForbiddenException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { localizedError } from '../../i18n/localized-error';
import { createValidationException } from '../../i18n/localized-validation';
import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: unknown, acceptLanguage?: string) {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status } as unknown as Record<string, unknown>;
    const host = {
        switchToHttp: () => ({
            getRequest: () => ({
                url: '/ruta',
                headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {},
            }),
            getResponse: () => response,
        }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(exception, host);

    return { status, body: json.mock.calls[0]?.[0], response };
}

// Imita los errores de `http-errors` que lanza `body-parser`.
function bodyParserError(status: number, type: string, expose = true) {
    return Object.assign(new Error('internal detail'), { status, statusCode: status, expose, type });
}

describe('HttpExceptionFilter', () => {
    it('responde 413 a un cuerpo demasiado grande', () => {
        const { status, body } = run(bodyParserError(413, 'entity.too.large'));
        expect(status).toHaveBeenCalledWith(413);
        expect(body).toMatchObject({
            statusCode: 413,
            message: 'El cuerpo de la petición excede el tamaño permitido.',
            error: 'PAYLOAD_TOO_LARGE',
            path: '/ruta',
        });
    });

    it('responde 415 a una codificación no soportada', () => {
        const { status, body } = run(bodyParserError(415, 'encoding.unsupported'));
        expect(status).toHaveBeenCalledWith(415);
        expect(body.message).toBe('La codificación del cuerpo de la petición no es compatible.');
    });

    it('usa un mensaje genérico para tipos desconocidos y nunca expone el mensaje interno', () => {
        const { status, body } = run(bodyParserError(400, 'otro.tipo'));
        expect(status).toHaveBeenCalledWith(400);
        expect(body.message).toBe('La petición no es válida.');
    });

    it('mantiene 500 para errores no expuestos o fuera del rango 4xx', () => {
        expect(run(bodyParserError(413, 'entity.too.large', false)).status).toHaveBeenCalledWith(500);
        expect(run(bodyParserError(502, 'x')).status).toHaveBeenCalledWith(500);
        const { status, body, response } = run(new Error('fallo inesperado'));
        expect(status).toHaveBeenCalledWith(500);
        expect(body.message).toBe('Ha ocurrido un error inesperado.');
        expect(response.err).toBeInstanceOf(Error);
    });

    it('sigue respetando las HttpException de Nest', () => {
        const { status, body } = run(new BadRequestException('Dato inválido.'));
        expect(status).toHaveBeenCalledWith(400);
        expect(body.message).toBe('Dato inválido.');
        expect(body.code).toBeNull();
    });

    it('traduce un error con código al idioma de Accept-Language', () => {
        const exception = new ForbiddenException(
            localizedError('FAVORITE_LIMIT_REACHED_PREMIUM', { limit: 50 }),
        );

        expect(run(exception).body).toMatchObject({
            statusCode: 403,
            code: 'FAVORITE_LIMIT_REACHED_PREMIUM',
            message: 'Alcanzaste el límite de 50 favoritos del plan Premium.',
        });
        expect(run(exception, 'en-US,en;q=0.9').body.message).toBe(
            'You reached the limit of 50 favorites on the Premium plan.',
        );
        expect(run(exception, 'fr').body.message).toBe(
            "Vous avez atteint la limite de 50 favoris de l'offre Premium.",
        );
        expect(run(exception, 'pt-BR').body.message).toBe(
            'Você atingiu o limite de 50 favoritos do plano Premium.',
        );
    });

    it('traduce cada campo de un error de validación', () => {
        const exception = createValidationException([
            {
                property: 'page',
                constraints: { min: 'La página debe ser mayor o igual a 1.' },
                contexts: { min: { code: 'VALIDATION_PAGE_MIN', params: { min: 1 } } },
                children: [],
            },
        ]);

        expect(run(exception, 'en').body).toMatchObject({
            statusCode: 400,
            code: 'VALIDATION_FAILED',
            message: ['The page must be greater than or equal to 1.'],
            details: [
                { field: 'page', code: 'VALIDATION_PAGE_MIN', message: 'The page must be greater than or equal to 1.' },
            ],
        });
    });

    it('traduce también los errores genéricos', () => {
        expect(run(bodyParserError(413, 'entity.too.large'), 'en').body).toMatchObject({
            code: 'REQUEST_BODY_TOO_LARGE',
            message: 'The request body exceeds the allowed size.',
        });
        expect(run(new Error('fallo'), 'pt').body.message).toBe('Ocorreu um erro inesperado.');
    });
});
