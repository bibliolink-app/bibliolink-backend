import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { localizedError } from '../../i18n/localized-error';

@Injectable()
export class RefreshJwtAuthGuard extends AuthGuard('jwt-refresh') {
    override handleRequest<TUser = unknown>(
        err: unknown,
        user: TUser,
        _info: unknown,
        _context: ExecutionContext,
        _status?: unknown,
    ): TUser {
        // Conserva los errores explícitos de la strategy; localiza solo el rechazo predeterminado de Passport.
        if (err || !user) {
            throw err || new UnauthorizedException(localizedError('AUTH_UNAUTHORIZED'));
        }

        return user;
    }
}
