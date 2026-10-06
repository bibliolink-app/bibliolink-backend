import { BadGatewayException, Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { envs } from '../../config/envs';

const MAX_REDIRECTS = 5;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);



@Injectable()
export class ReadingContentFetcherService {
    constructor(
        @InjectPinoLogger(ReadingContentFetcherService.name)
        private readonly logger: PinoLogger,
    ) { }

    async fetchContent(contentReference: string): Promise<Buffer> {
        let currentUrl = this.parseUrl(contentReference);

        try {
            for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
                await this.ensurePublicDestination(currentUrl);

                const response = await fetch(currentUrl, {
                    method: 'GET',
                    redirect: 'manual',
                    headers: {
                        Accept: '*/*',
                        'User-Agent': 'BiblioLink/1.0',
                    },
                    signal: AbortSignal.timeout(envs.reading.contentRequestTimeoutMs),
                });

                if (REDIRECT_STATUS_CODES.has(response.status)) {
                    const location = response.headers.get('location');

                    await response.body?.cancel();

                    if (!location) {
                        throw new BadGatewayException('El proveedor devolvió una redirección inválida.');
                    }

                    if (redirectCount === MAX_REDIRECTS) {
                        throw new BadGatewayException('El contenido excedió el límite de redirecciones.');
                    }

                    currentUrl = this.parseUrl(location, currentUrl);
                    continue;
                }

                if (!response.ok) {
                    await response.body?.cancel();

                    throw new BadGatewayException(
                        `No fue posible obtener el contenido del libro. Estado HTTP ${response.status}.`,
                    );
                }

                const body = await this.readLimitedBody(response);

                return body;

            }

            throw new BadGatewayException('No fue posible obtener el contenido del libro.');
        } catch (error: unknown) {
            this.logger.error(
                {
                    err: error,
                    url: currentUrl.origin + currentUrl.pathname,
                },
                'Falló la obtención del contenido de lectura',
            );

            if (error instanceof BadGatewayException) {
                throw error;
            }

            throw new BadGatewayException('No fue posible obtener el contenido del libro.');
        }
    }

    private parseUrl(value: string, baseUrl?: URL): URL {
        let url: URL;

        try {
            url = baseUrl ? new URL(value, baseUrl) : new URL(value);
        } catch {
            throw new BadGatewayException('La referencia del contenido no contiene una URL válida.');
        }

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new BadGatewayException('El protocolo del contenido no está permitido.');
        }

        if (url.username || url.password) {
            throw new BadGatewayException('La referencia del contenido contiene credenciales no permitidas.');
        }

        return url;
    }

    private async ensurePublicDestination(url: URL): Promise<void> {
        const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

        if (
            hostname === 'localhost' ||
            hostname.endsWith('.localhost') ||
            hostname.endsWith('.local')
        ) {
            throw new BadGatewayException('El destino del contenido no está permitido.');
        }

        if (isIP(hostname)) {
            if (!this.isPublicIp(hostname)) {
                throw new BadGatewayException('El destino del contenido no está permitido.');
            }

            return;
        }

        const addresses = await lookup(hostname, {
            all: true,
            verbatim: true,
        });

        if (
            addresses.length === 0 ||
            addresses.some(({ address }) => !this.isPublicIp(address))
        ) {
            throw new BadGatewayException('El destino del contenido no está permitido.');
        }
    }

    private async readLimitedBody(response: Response): Promise<Buffer> {
        const declaredLength = Number(response.headers.get('content-length'));

        if (
            Number.isFinite(declaredLength) &&
            declaredLength > envs.reading.contentMaxBytes
        ) {
            await response.body?.cancel();

            throw new BadGatewayException('El contenido del libro excede el tamaño permitido.');
        }

        if (!response.body) {
            return Buffer.alloc(0);
        }

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            totalBytes += value.byteLength;

            if (totalBytes > envs.reading.contentMaxBytes) {
                await reader.cancel();

                throw new BadGatewayException('El contenido del libro excede el tamaño permitido.');
            }

            chunks.push(value);
        }

        return Buffer.concat(chunks, totalBytes);
    }

    private isPublicIp(address: string): boolean {
        if (isIP(address) === 4) {
            const octets = address.split('.').map(Number);
            const [a, b] = octets;

            return !(
                a === 0 ||
                a === 10 ||
                a === 127 ||
                (a === 100 && b! >= 64 && b! <= 127) ||
                (a === 169 && b === 254) ||
                (a === 172 && b! >= 16 && b! <= 31) ||
                (a === 192 && b === 0) ||
                (a === 192 && b === 168) ||
                (a === 198 && (b === 18 || b === 19)) ||
                (a === 198 && b === 51) ||
                (a === 203 && b === 0) ||
                a! >= 224
            );
        }

        if (isIP(address) === 6) {
            const normalized = address.toLowerCase();

            return !(
                normalized === '::' ||
                normalized === '::1' ||
                normalized.startsWith('::ffff:') ||
                normalized.startsWith('fc') ||
                normalized.startsWith('fd') ||
                /^fe[89ab]/.test(normalized) ||
                normalized.startsWith('ff') ||
                normalized.startsWith('2001:db8:')
            );
        }

        return false;
    }
}