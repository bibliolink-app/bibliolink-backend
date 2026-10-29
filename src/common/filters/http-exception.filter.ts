import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

import type { Request, Response } from 'express';

type ErrorResponse = {
    statusCode: number;
    message: string | string[];
    error: string;
    path: string;
    timestamp: string;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();

        const request = context.getRequest<Request>();
        const response = context.getResponse<Response>();

        const clientError = this.getExposedClientError(exception);

        const statusCode =
            exception instanceof HttpException
                ? exception.getStatus()
                : clientError?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;

        // pino-http registra el error original una sola vez al finalizar la respuesta.
        if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error) {
            response.err = exception;
        }

        const exceptionResponse =
            exception instanceof HttpException
                ? exception.getResponse()
                : clientError?.message ?? 'Ha ocurrido un error inesperado.';

        const message =
            typeof exceptionResponse === 'string'
                ? exceptionResponse
                : this.getMessage(exceptionResponse);

        const errorResponse: ErrorResponse = {
            statusCode,
            message,
            error: HttpStatus[statusCode] ?? 'Error',
            path: request.url,
            timestamp: new Date().toISOString(),
        };

        response.status(statusCode).json(errorResponse);
    }

    // Express y `body-parser` rechazan algunas peticiones antes de que lleguen
    // a Nest (cuerpo demasiado grande, codificación no soportada…) con errores
    // de `http-errors`: traen su código 4xx y `expose: true` cuando es seguro
    // mostrarlos. Sin esto se respondían como 500 y quedaban registrados como
    // errores del servidor.
    private getExposedClientError(exception: unknown): { statusCode: number; message: string } | null {
        if (
            typeof exception !== 'object' ||
            exception === null ||
            !('expose' in exception) ||
            exception.expose !== true ||
            !('status' in exception) ||
            typeof exception.status !== 'number' ||
            exception.status < 400 ||
            exception.status > 499
        ) {
            return null;
        }

        const type = 'type' in exception ? exception.type : undefined;

        const messagesByType: Record<string, string> = {
            'entity.too.large': 'El cuerpo de la petición excede el tamaño permitido.',
            'entity.parse.failed': 'El cuerpo de la petición no tiene un formato válido.',
            'encoding.unsupported': 'La codificación del cuerpo de la petición no es compatible.',
            'charset.unsupported': 'El juego de caracteres del cuerpo de la petición no es compatible.',
        };

        return {
            statusCode: exception.status,
            message: (typeof type === 'string' && messagesByType[type]) || 'La petición no es válida.',
        };
    }

    private getMessage(response: object): string | string[] {
        if (
            'message' in response &&
            (
                typeof response.message === 'string' ||
                (
                    Array.isArray(response.message) &&
                    response.message.every(
                        (message) => typeof message === 'string',
                    )
                )
            )
        ) {
            return response.message;
        }

        return 'Ha ocurrido un error inesperado.';
    }
}
