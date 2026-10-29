import { BadRequestException, ParseEnumPipe, ParseIntPipe } from '@nestjs/common';

import { localizedError } from './localized-error';
import type { MessageCode } from './messages';

// Versiones de los pipes de Nest para parámetros de ruta que responden con
// un código traducible en vez de su mensaje fijo en inglés
// ("Validation failed (numeric string is expected)").

export function localizedParseIntPipe(code: MessageCode): ParseIntPipe {
    return new ParseIntPipe({
        exceptionFactory: () => new BadRequestException(localizedError(code)),
    });
}

export function localizedParseEnumPipe<T extends object>(
    enumType: T,
    code: MessageCode,
): ParseEnumPipe<T> {
    return new ParseEnumPipe(enumType, {
        exceptionFactory: () => new BadRequestException(localizedError(code)),
    });
}
