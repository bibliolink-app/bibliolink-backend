import type { ThrottlerOptions } from '@nestjs/throttler';

import { envs } from './envs';

export const throttlingConfig: ThrottlerOptions[] = [
    {
        ttl: envs.throttling.global.ttl,
        limit: envs.throttling.global.limit,
    },
];