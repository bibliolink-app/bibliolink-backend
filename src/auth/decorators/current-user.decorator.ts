import {
    createParamDecorator,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';

import { localizedError } from '../../i18n/localized-error';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
        const request = context
            .switchToHttp()
            .getRequest<{ user?: AuthenticatedUser }>();

        if (!request.user) {
            throw new UnauthorizedException(localizedError('AUTH_UNAUTHORIZED'));
        }

        return request.user;
    },
);
