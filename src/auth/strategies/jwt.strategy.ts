import {
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { envs } from '../../config/envs';
import type { UserListItemResponseDto } from '../../users/dto/user-list-item-response.dto';
import { UserStatus } from '../../users/enums/user-status.enum';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(private readonly usersService: UsersService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: Request): string | null => {
                    const token = request.cookies?.access_token;

                    return typeof token === 'string' ? token : null;
                },
            ]),
            secretOrKey: envs.jwt.access.secret,
            algorithms: ['HS256'],
            ignoreExpiration: false,
        });
    }

    async validate(payload: unknown): Promise<AuthenticatedUser> {
        if (
            typeof payload !== 'object' ||
            payload === null ||
            !('sub' in payload) ||
            typeof payload.sub !== 'string' ||
            !/^[1-9]\d*$/.test(payload.sub) ||
            !Number.isSafeInteger(Number(payload.sub))
        ) {
            throw new UnauthorizedException();
        }

        let user: UserListItemResponseDto;
        // Un usuario eliminado invalida la autenticación: corresponde 401, no 404.
        try {
            user = await this.usersService.findById(Number(payload.sub));
        } catch (error: unknown) {
            if (error instanceof NotFoundException) {
                throw new UnauthorizedException();
            }

            throw error;
        }

        if (user.status !== UserStatus.ACTIVE) {
            throw new UnauthorizedException();
        }

        return {
            userId: user.userId,
            role: user.role,
            status: user.status,
        };
    }
}
