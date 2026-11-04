import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { localizedError } from '../../i18n/localized-error';
import { UserRole } from '../../users/enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!roles?.length) {
            return true;
        }

        const { user } = context
            .switchToHttp()
            .getRequest<{ user?: AuthenticatedUser }>();
        if (!user) {
            throw new UnauthorizedException(localizedError('AUTH_UNAUTHORIZED'));
        }

        if (!roles.includes(user.role)) {
            throw new ForbiddenException(localizedError('AUTH_FORBIDDEN'));
        }

        return true;
    }
}
