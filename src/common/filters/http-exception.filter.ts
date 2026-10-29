import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

import type { Request, Response } from 'express';

import type { Language } from '../../i18n/i18n.constants';
import { isLocalizedErrorBody } from '../../i18n/localized-error';
import { isValidationErrorBody, type ValidationErrorDetail } from '../../i18n/localized-validation';
import type { MessageCode } from '../../i18n/messages';
import { resolveLanguage, translate } from '../../i18n/translate';

type ErrorResponse = {
    statusCode: number;
    // Código estable del error para que el frontend reaccione sin comparar
    // textos. `null` en los módulos que todavía no usan los archivos de idioma.
    code: string | null;
    message: string | string[];
    // Solo en errores de validación: un elemento por cada campo inválido.
    details?: Omit<ValidationErrorDetail, 'params'>[];
    error: string;
    path: string;
    timestamp: string;
};

// Parte de la respuesta que depende del tipo de excepción.
type LocalizedContent = Pick<ErrorResponse, 'code' | 'message' | 'details'>;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();

        const request = context.getRequest<Request>();
        const response = context.getResponse<Response>();

<<<<<<< Updated upstream
=======
        // El frontend indica su idioma en `Accept-Language`.
        const language = resolveLanguage(request.headers?.['accept-language']);

        const clientError = this.getExposedClientError(exception);

>>>>>>> Stashed changes
        const statusCode =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // pino-http registra el error original una sola vez al finalizar la respuesta.
        if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error) {
            response.err = exception;
        }

<<<<<<< Updated upstream
        const exceptionResponse =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Ha ocurrido un error inesperado.';
=======
        let content: LocalizedContent;
>>>>>>> Stashed changes

        if (exception instanceof HttpException) {
            content = this.getHttpExceptionContent(exception.getResponse(), language);
        } else {
            const code = clientError?.code ?? 'INTERNAL_ERROR';

            content = { code, message: translate(code, language) };
        }

        const errorResponse: ErrorResponse = {
            statusCode,
            ...content,
            error: HttpStatus[statusCode] ?? 'Error',
            path: request.url,
            timestamp: new Date().toISOString(),
        };

        response.status(statusCode).json(errorResponse);
    }

<<<<<<< Updated upstream
    private getMessage(response: object): string | string[] {
=======
    private getHttpExceptionContent(
        exceptionResponse: string | object,
        language: Language,
    ): LocalizedContent {
        if (isValidationErrorBody(exceptionResponse)) {
            const details = exceptionResponse.details.map((detail) => ({
                field: detail.field,
                code: detail.code,
                message: detail.code
                    ? translate(detail.code, language, detail.params)
                    : detail.message,
            }));

            return {
                code: exceptionResponse.code,
                message: details.map((detail) => detail.message),
                details,
            };
        }

        if (isLocalizedErrorBody(exceptionResponse)) {
            return {
                code: exceptionResponse.code,
                message: translate(exceptionResponse.code, language, exceptionResponse.params),
            };
        }

        // Excepciones con un mensaje fijo (módulos que aún no usan los
        // archivos de idioma, guards, throttler…): se devuelven tal cual.
        if (typeof exceptionResponse === 'string') {
            return { code: null, message: exceptionResponse };
        }

        return {
            code: null,
            message: this.getMessage(exceptionResponse) ?? translate('INTERNAL_ERROR', language),
        };
    }

    // Express y `body-parser` rechazan algunas peticiones antes de que lleguen
    // a Nest (cuerpo demasiado grande, codificación no soportada…) con errores
    // de `http-errors`: traen su código 4xx y `expose: true` cuando es seguro
    // mostrarlos. Sin esto se respondían como 500 y quedaban registrados como
    // errores del servidor.
    private getExposedClientError(exception: unknown): { statusCode: number; code: MessageCode } | null {
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

        const codesByType: Record<string, MessageCode> = {
            'entity.too.large': 'REQUEST_BODY_TOO_LARGE',
            'entity.parse.failed': 'REQUEST_BODY_MALFORMED',
            'encoding.unsupported': 'REQUEST_ENCODING_UNSUPPORTED',
            'charset.unsupported': 'REQUEST_CHARSET_UNSUPPORTED',
        };

        return {
            statusCode: exception.status,
            code: (typeof type === 'string' && codesByType[type]) || 'REQUEST_INVALID',
        };
    }

    private getMessage(response: object): string | string[] | null {
>>>>>>> Stashed changes
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

        return null;
    }
}
