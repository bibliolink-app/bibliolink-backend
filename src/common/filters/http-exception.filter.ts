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

        const statusCode =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // pino-http registra el error original una sola vez al finalizar la respuesta.
        if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error) {
            response.err = exception;
        }

        const exceptionResponse =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Ha ocurrido un error inesperado.';

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
