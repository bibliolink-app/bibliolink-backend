import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CAPTCHA_PROVIDER } from './constants/captcha.constants';
import type { CaptchaProvider } from './interfaces/captcha-provider.interface';

@Injectable()
export class CaptchaService {
    constructor(
        @InjectPinoLogger(CaptchaService.name)
        private readonly logger: PinoLogger,
        @Inject(CAPTCHA_PROVIDER)
        private readonly captchaProvider: CaptchaProvider,
    ) {}

    verify(token: string): Promise<boolean> {
        this.logger.debug('Verifying CAPTCHA');
        return this.captchaProvider.verify(token);
    }
}
