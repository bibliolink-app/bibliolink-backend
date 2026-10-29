import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CATALOG_REQUEST_TIMEOUT_MS, CATALOG_USER_AGENT, } from '../constants/catalogs.constants';

interface CatalogRequestOptions {
    // Proveedor que origina la llamada; se usa en los registros y en el error.
    providerCode: string;

    // Cabecera `Accept` solicitada. Algunas APIs cambian el formato según ella.
    accept: string;

    // Tiempo límite propio del proveedor. Sirve para las APIs que
    // responden con lentitud; si se omite se usa el valor general.
    timeoutMs?: number;
}

// Cliente HTTP compartido por los proveedores externos del catálogo.
// Centraliza el tiempo de espera, el agente de usuario y el tratamiento
// de errores para que cada proveedor se ocupe solo de mapear datos.
@Injectable()
export class CatalogHttpService {
    constructor(
        @InjectPinoLogger(CatalogHttpService.name)
        private readonly logger: PinoLogger,
    ) {}

    // Descarga y decodifica una respuesta JSON.
    async getJson<T>(
        url: URL,
        options: CatalogRequestOptions,
    ): Promise<T> {
        const body = await this.request(url, options);

        try {
            return JSON.parse(body) as T;
        } catch (error: unknown) {
            this.logger.error(
                { err: error, providerCode: options.providerCode, url: url.origin + url.pathname },
                'La respuesta del proveedor externo no es un JSON válido',
            );

            throw this.buildUnavailableError(options.providerCode);
        }
    }

    // Descarga una respuesta de texto (por ejemplo, un feed XML).
    getText(
        url: URL,
        options: CatalogRequestOptions,
    ): Promise<string> {
        return this.request(url, options);
    }

    // Ejecuta la llamada aplicando tiempo límite y validando el estado HTTP.
    private async request(
        url: URL,
        options: CatalogRequestOptions,
    ): Promise<string> {
        let statusCode: number | undefined;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': options.accept,
                    'User-Agent': CATALOG_USER_AGENT,
                },
                signal: AbortSignal.timeout(
                    options.timeoutMs ?? CATALOG_REQUEST_TIMEOUT_MS,
                ),
            });

            statusCode = response.status;

            if (!response.ok) {
                throw new Error(
                    `El proveedor externo respondió con el estado HTTP ${response.status}.`,
                );
            }

            return await response.text();
        } catch (error: unknown) {
            this.logger.error(
                {
                    err: error,
                    providerCode: options.providerCode,
                    statusCode,
                    // Se registra la ruta sin la cadena de consulta para no
                    // volcar los términos de búsqueda en los registros.
                    url: url.origin + url.pathname,
                },
                'Falló la consulta al proveedor externo del catálogo',
            );

            throw this.buildUnavailableError(options.providerCode);
        }
    }

    private buildUnavailableError(
        providerCode: string,
    ): ServiceUnavailableException {
        return new ServiceUnavailableException(
            `El proveedor de contenido "${providerCode}" no está disponible en este momento.`,
        );
    }
}
