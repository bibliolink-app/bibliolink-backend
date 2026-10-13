import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { envs } from '../../config/envs';
import type { CaptchaProvider } from '../interfaces/captcha-provider.interface';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const REQUEST_TIMEOUT_MS = 5000;

@Injectable()
export class CloudflareTurnstileProvider implements CaptchaProvider {
    constructor(
        @InjectPinoLogger(CloudflareTurnstileProvider.name)
        private readonly logger: PinoLogger,
    ) {}

    async verify(token: string): Promise<boolean> {
        let stage = 'request';
        let statusCode: number | undefined;
        try {
            const response = await fetch(SITEVERIFY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    secret: envs.captcha.secretKey,
                    response: token,
                }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                redirect: 'error',
            });

            statusCode = response.status;
            stage = 'http_status';
            if (!response.ok) {
                throw new Error('CAPTCHA provider returned an unsuccessful HTTP status.');
            }

            stage = 'decode_response';
            const result: unknown = await response.json();

            stage = 'validate_response';
            if (
                typeof result !== 'object' ||
                result === null ||
                Array.isArray(result) ||
                !('success' in result) ||
                typeof result.success !== 'boolean'
            ) {
                throw new Error('CAPTCHA provider returned an invalid response.');
            }

            if (!result.success) {
                this.logger.warn('Turnstile rejected CAPTCHA verification');
            } else {
                this.logger.debug('Turnstile verification completed successfully');
            }
            return result.success;
        } catch (error: unknown) {
            this.logger.error({ err: error, stage, statusCode }, 'Cloudflare Turnstile verification failed');
            throw new ServiceUnavailableException(
                'El servicio de verificación CAPTCHA no está disponible.',
            );
        }
    }
}
