import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { HttpExceptionFilter } from './http-exception.filter';

function run(exception: unknown) {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status } as unknown as Record<string, unknown>;
    const host = {
        switchToHttp: () => ({
            getRequest: () => ({ url: '/ruta' }),
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
    });
});
