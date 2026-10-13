import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';

import { envs } from './envs';

export const loggingConfig: Params = {
    pinoHttp: {
        level: envs.isProduction ? 'info' : 'debug',
        genReqId: () => randomUUID(),
        wrapSerializers: false,
        hooks: {
            logMethod(args, method) {
                const entry = args[0];
                // Pino copia err.message a msg si el adaptador de Nest no proporciona mensaje.
                if (args.length === 1 && typeof entry === 'object' && entry !== null
                    && (entry instanceof Error || 'err' in entry)) {
                    method.call(this, entry, 'Application error');
                    return;
                }
                method.apply(this, args);
            },
        },
        serializers: {
            // Las URLs, headers y cuerpos pueden contener credenciales, incluso en errores.
            req: (request: IncomingMessage & { id?: string }) => ({
                id: request.id,
                method: request.method,
            }),
            res: (response: ServerResponse & { req: IncomingMessage & { route?: unknown } }) => {
                const route = response.req.route;
                return {
                    statusCode: response.statusCode,
                    // Solo el patrón registrado de la ruta, nunca parámetros ni query strings.
                    route: typeof route === 'object' && route !== null
                        && 'path' in route && typeof route.path === 'string'
                        ? route.path : undefined,
                };
            },
            // Los mensajes, stacks, causas y respuestas de proveedores pueden incluir secretos.
            // Conservar únicamente metadata técnica permitida, también fuera del contexto HTTP.
            err: (error: unknown) => {
                if (typeof error !== 'object' || error === null) {
                    return { type: 'UnknownError' };
                }

                const name = error instanceof Error ? error.name : '';
                const type = [
                    'Error', 'TypeError', 'RangeError', 'SyntaxError',
                    'AbortError', 'TimeoutError', 'QueryFailedError',
                    'ServiceUnavailableException', 'BrevoError',
                ].includes(name) ? name : 'Error';
                const code = 'code' in error && typeof error.code === 'string'
                    && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND',
                        'EAI_AGAIN', 'ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK',
                        'ER_LOCK_WAIT_TIMEOUT', 'ABORT_ERR'].includes(error.code)
                    ? error.code : undefined;
                const statusCode = 'statusCode' in error && typeof error.statusCode === 'number'
                    ? error.statusCode : undefined;

                return { type, code, statusCode };
            },
        },
        redact: {
            paths: [
                'password', 'passwordHash', 'currentPassword', 'newPassword',
                'token', 'tokenHash', 'accessToken', 'refreshToken', 'captchaToken',
                'resetUrl', 'secret', 'apiKey', 'authorization', 'cookie', 'cookies',
                'req.headers', 'req.body', 'req.url', 'req.query', 'req.params',
                'res.headers', 'res.body',
            ],
            remove: true,
        },
        customLogLevel: (_request, response, error) => {
            if (error || response.statusCode >= 500) return 'error';
            if (response.statusCode >= 400) return 'warn';
            return 'info';
        },
    },
};
