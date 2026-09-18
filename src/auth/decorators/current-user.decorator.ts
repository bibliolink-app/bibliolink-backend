import {
    createParamDecorator,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
        const request = context
            .switchToHttp()
            .getRequest<{ user?: AuthenticatedUser }>();

        if (!request.user) {
            throw new UnauthorizedException();
        }

        return request.user;
    },
);
