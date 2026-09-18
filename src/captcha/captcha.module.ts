import { Module } from '@nestjs/common';

import { CAPTCHA_PROVIDER } from './constants/captcha.constants';
import { CaptchaService } from './captcha.service';
import { CloudflareTurnstileProvider } from './providers/cloudflare-turnstile.provider';

@Module({
    providers: [
        CaptchaService,
        CloudflareTurnstileProvider,
        {
            provide: CAPTCHA_PROVIDER,
            useExisting: CloudflareTurnstileProvider,
        },
    ],
    exports: [CaptchaService],
})
export class CaptchaModule {}
