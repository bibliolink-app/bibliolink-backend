import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { Language } from './i18n.constants';
import { resolveLanguage } from './translate';

// Idioma de la petición, según `Accept-Language`. Sirve para traducir
// textos que van dentro de una respuesta exitosa; los errores ya los traduce
// `HttpExceptionFilter`.
export const RequestLanguage = createParamDecorator(
    (_data: unknown, context: ExecutionContext): Language =>
        resolveLanguage(context.switchToHttp().getRequest<Request>().headers['accept-language']),
);
