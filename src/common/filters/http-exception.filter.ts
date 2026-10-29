
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
import {
    isValidationErrorBody,
    type ValidationErrorDetail,
} from '../../i18n/localized-validation';
import type { MessageCode } from '../../i18n/messages';
import { resolveLanguage, translate } from '../../i18n/translate';

type ErrorResponse = {
    statusCode: number;
    code: string | null;
    message: string | string[];
    details?: Omit<ValidationErrorDetail, 'params'>[];
    error: string;
    path: string;
    timestamp: string;
};

type LocalizedContent = Pick<
    ErrorResponse,
    'code' | 'message' | 'details'
>;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();
        const request = context.getRequest<Request>();
        const response = context.getResponse<Response>();

        const language = resolveLanguage(
            request.headers?.['accept-language'],
        );

        const clientError = this.getExposedClientError(exception);

        const statusCode =
            exception instanceof HttpException
                ? exception.getStatus()
                : clientError?.statusCode ??
                  HttpStatus.INTERNAL_SERVER_ERROR;

        if (
            statusCode >= HttpStatus.INTERNAL_SERVER_ERROR &&
            exception instanceof Error
        ) {
            response.err = exception;
        }

        let content: LocalizedContent;

        if (exception instanceof HttpException) {
            content = this.getHttpExceptionContent(
                exception.getResponse(),
                language,
            );
        } else {
            const code = clientError?.code ?? 'INTERNAL_ERROR';

            content = {
                code,
                message: translate(code, language),
            };
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

    private getHttpExceptionContent(
        exceptionResponse: string | object,
        language: Language,
    ): LocalizedContent {
        if (isValidationErrorBody(exceptionResponse)) {
            const details = exceptionResponse.details.map(
                (detail) => ({
                    field: detail.field,
                    code: detail.code,
                    message: detail.code
                        ? translate(
                              detail.code,
                              language,
                              detail.params,
                          )
                        : detail.message,
                }),
            );

            return {
                code: exceptionResponse.code,
                message: details.map((detail) => detail.message),
                details,
            };
        }

        if (isLocalizedErrorBody(exceptionResponse)) {
            return {
                code: exceptionResponse.code,
                message: translate(
                    exceptionResponse.code,
                    language,
                    exceptionResponse.params,
                ),
            };
        }

        if (typeof exceptionResponse === 'string') {
            return {
                code: null,
                message: exceptionResponse,
            };
        }

        return {
            code: null,
            message:
                this.getMessage(exceptionResponse) ??
                translate('INTERNAL_ERROR', language),
        };
    }

    private getExposedClientError(
        exception: unknown,
    ): { statusCode: number; code: MessageCode } | null {
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

        const type =
            'type' in exception ? exception.type : undefined;

        const codesByType: Record<string, MessageCode> = {
            'entity.too.large': 'REQUEST_BODY_TOO_LARGE',
            'entity.parse.failed': 'REQUEST_BODY_MALFORMED',
            'encoding.unsupported': 'REQUEST_ENCODING_UNSUPPORTED',
            'charset.unsupported': 'REQUEST_CHARSET_UNSUPPORTED',
        };

        const code =
            typeof type === 'string' &&
            Object.hasOwn(codesByType, type)
                ? codesByType[type]
                : undefined;

        return {
            statusCode: exception.status,
            code: code ?? 'REQUEST_INVALID',
        };
    }

    private getMessage(
        response: object,
    ): string | string[] | null {
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
