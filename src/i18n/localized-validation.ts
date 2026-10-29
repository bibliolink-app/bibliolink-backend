import { BadRequestException } from '@nestjs/common';
import type { ValidationError, ValidationOptions } from 'class-validator';

import { DEFAULT_LANGUAGE } from './i18n.constants';
import type { MessageCode } from './messages';
import { isMessageCode, translate, type MessageParams } from './translate';

// Código general de una respuesta con errores de validación. El detalle de
// cada campo va en `details`.
export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';

interface LocalizedValidationContext {
    code: MessageCode;
    params?: MessageParams;
}

// Un error de validación de un campo.
export interface ValidationErrorDetail {
    field: string;

    // `null` en los módulos que todavía no usan los archivos de idioma: su
    // mensaje se devuelve tal cual.
    code: MessageCode | null;

    params?: MessageParams;

    message: string;
}

export interface ValidationErrorBody {
    code: typeof VALIDATION_FAILED_CODE;
    message: string[];
    details: ValidationErrorDetail[];
}

// Opciones para un decorador de `class-validator`:
//
//     @Max(50, localizedValidation('VALIDATION_PAGE_SIZE_MAX', { max: 50 }))
//
// El código viaja en `context` y se traduce al responder. `message` queda en
// el idioma por omisión por si el DTO se valida fuera de la API.
export function localizedValidation(
    code: MessageCode,
    params?: MessageParams,
): ValidationOptions {
    const context: LocalizedValidationContext = { code, ...(params && { params }) };

    return {
        message: translate(code, DEFAULT_LANGUAGE, params),
        context,
    };
}

// `exceptionFactory` del `ValidationPipe` global: en vez de una lista de
// textos sueltos, arma un error por campo con su código.
export function createValidationException(
    errors: ValidationError[],
): BadRequestException {
    const details = flattenValidationErrors(errors);

    const body: ValidationErrorBody = {
        code: VALIDATION_FAILED_CODE,
        message: details.map((detail) => detail.message),
        details,
    };

    return new BadRequestException(body);
}

export function isValidationErrorBody(value: unknown): value is ValidationErrorBody {
    return (
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        value.code === VALIDATION_FAILED_CODE &&
        'details' in value &&
        Array.isArray(value.details)
    );
}

function flattenValidationErrors(
    errors: ValidationError[],
    parentField = '',
): ValidationErrorDetail[] {
    return errors.flatMap((error) => {
        const field = parentField ? `${parentField}.${error.property}` : error.property;

        const ownDetails = Object.entries(error.constraints ?? {}).map(
            ([constraint, message]) =>
                toDetail(field, constraint, message, error.contexts?.[constraint]),
        );

        return [...ownDetails, ...flattenValidationErrors(error.children ?? [], field)];
    });
}

function toDetail(
    field: string,
    constraint: string,
    message: string,
    context: unknown,
): ValidationErrorDetail {
    // `forbidNonWhitelisted` rechaza los campos que el DTO no declara.
    if (constraint === 'whitelistValidation') {
        const params = { property: field };

        return {
            field,
            code: 'VALIDATION_PROPERTY_NOT_ALLOWED',
            params,
            message: translate('VALIDATION_PROPERTY_NOT_ALLOWED', DEFAULT_LANGUAGE, params),
        };
    }

    if (isLocalizedValidationContext(context)) {
        return {
            field,
            code: context.code,
            ...(context.params && { params: context.params }),
            message,
        };
    }

    return { field, code: null, message };
}

function isLocalizedValidationContext(value: unknown): value is LocalizedValidationContext {
    return (
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        isMessageCode(value.code)
    );
}
