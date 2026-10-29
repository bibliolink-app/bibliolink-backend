import { DEFAULT_LANGUAGE } from './i18n.constants';
import type { MessageCode } from './messages';
import { isMessageCode, translate, type MessageParams } from './translate';

// Cuerpo de una `HttpException` cuyo mensaje se traduce al responder:
//
//     throw new NotFoundException(localizedError('BOOK_NOT_FOUND'));
//
// `HttpExceptionFilter` lee `code` y `params` y arma el mensaje en el idioma
// de la petición.
export interface LocalizedErrorBody {
    code: MessageCode;

    params?: MessageParams;

    // Texto en el idioma por omisión. Nest lo usa como `error.message`, así
    // que es lo que aparece en los registros y lo que ve quien capture la
    // excepción fuera de una petición HTTP.
    message: string;
}

export function localizedError(
    code: MessageCode,
    params?: MessageParams,
): LocalizedErrorBody {
    return {
        code,
        ...(params && { params }),
        message: translate(code, DEFAULT_LANGUAGE, params),
    };
}

export function isLocalizedErrorBody(value: unknown): value is LocalizedErrorBody {
    return (
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        isMessageCode(value.code)
    );
}
