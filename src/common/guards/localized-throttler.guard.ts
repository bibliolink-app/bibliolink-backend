import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { localizedError } from '../../i18n/localized-error';

@Injectable()
export class LocalizedThrottlerGuard extends ThrottlerGuard {
    // El guard base conserva el conteo, los límites y Retry-After; solo cambia el mensaje público.
    protected override async throwThrottlingException(): Promise<void> {
        throw new HttpException(
            localizedError('REQUEST_RATE_LIMITED'),
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }
}
