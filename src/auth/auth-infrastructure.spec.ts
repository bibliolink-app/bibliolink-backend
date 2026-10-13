import 'reflect-metadata';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { envs } from '../config/envs';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { AuthCookieService } from './cookies/auth-cookie.service';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshJwtAuthGuard } from './guards/refresh-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshJwtStrategy } from './strategies/refresh-jwt.strategy';

const testEnvs = vi.hoisted(() => ({
    isProduction: false,
    jwt: {
        access: {
            secret: 'test-access-secret-at-least-32-characters',
            expiresIn: '15m',
        },
        refresh: {
            secret: 'test-refresh-secret-at-least-32-characters',
            expiresIn: '7d',
        },
    },
}));
vi.mock('../config/envs', () => ({ envs: testEnvs }));

@Roles(UserRole.ADMIN)
class ProtectedController {
    admin(): void {}

    @Roles(UserRole.USER)
    reader(): void {}
}

function contextFor(
    request: object,
    handler = ProtectedController.prototype.admin,
) {
    return new ExecutionContextHost(
        [request, {}],
        ProtectedController,
        handler,
    );
}

describe('JWT strategies through Passport guards', () => {
    const jwt = new JwtService();
    const findById = vi.fn<UsersService['findById']>();
    const user = {
        userId: 7,
        username: 'reader',
        firstName: 'Test',
        middleName: null,
        firstSurname: 'User',
        secondSurname: null,
        birthDate: '2000-01-01',
        email: 'reader@example.test',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
    };
    let closeModule: () => Promise<void>;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            providers: [{ provide: UsersService, useValue: { findById } }],
        }).compile();
        new JwtStrategy(module.get(UsersService));
        new RefreshJwtStrategy(module.get(UsersService));
        closeModule = () => module.close();
    });
    afterAll(async () => {
        await closeModule();
    });
    beforeEach(() => {
        findById.mockReset().mockResolvedValue(user);
    });

    describe.each([
        ['access', 'access_token', new JwtAuthGuard()],
        ['refresh', 'refresh_token', new RefreshJwtAuthGuard()],
    ] as const)('%s', (kind, cookie, guard) => {
        const config = envs.jwt[kind];
        const sign = (payload: object) =>
            jwt.sign(payload, { ...config, algorithm: 'HS256' });
        const authenticate = (token: unknown) =>
            guard.canActivate(contextFor({ cookies: { [cookie]: token } }));

        it('accepts its cookie and returns only the current ACTIVE user context', async () => {
            const request: {
                cookies: Record<string, string>;
                user?: AuthenticatedUser;
            } = {
                cookies: { [cookie]: sign({ sub: '7', role: UserRole.ADMIN }) },
            };
            await expect(guard.canActivate(contextFor(request))).resolves.toBe(
                true,
            );
            expect(findById).toHaveBeenCalledWith(7);
            expect(request.user).toEqual({
                userId: 7,
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
            });
            findById.mockResolvedValueOnce({ ...user, role: UserRole.ADMIN });
            await guard.canActivate(contextFor(request));
            expect(request.user?.role).toBe(UserRole.ADMIN);
        });

        it('rejects nonexistent and INACTIVE users while preserving unexpected errors', async () => {
            const token = sign({ sub: '7' });
            findById.mockRejectedValueOnce(new NotFoundException());
            await expect(authenticate(token)).rejects.toBeInstanceOf(
                UnauthorizedException,
            );
            findById.mockResolvedValueOnce({
                ...user,
                status: UserStatus.INACTIVE,
            });
            await expect(authenticate(token)).rejects.toBeInstanceOf(
                UnauthorizedException,
            );
            const failure = new Error('Persistence unavailable');
            findById.mockRejectedValueOnce(failure);
            await expect(authenticate(token)).rejects.toBe(failure);
        });

        it('rejects expired, tampered, wrong-kind and wrong-algorithm tokens before querying users', async () => {
            const other = envs.jwt[kind === 'access' ? 'refresh' : 'access'];
            const tokens = [
                jwt.sign({ sub: '7' }, { ...config, expiresIn: -1 }),
                `${sign({ sub: '7' })}invalid`,
                jwt.sign({ sub: '7' }, { ...other, algorithm: 'HS256' }),
                jwt.sign({ sub: '7' }, { ...config, algorithm: 'HS384' }),
            ];
            for (const token of tokens) {
                await expect(authenticate(token)).rejects.toBeInstanceOf(
                    UnauthorizedException,
                );
            }
            expect(findById).not.toHaveBeenCalled();
        });

        it('requires a valid subject and expiration claim', async () => {
            for (const sub of [
                undefined,
                7,
                '0',
                '-1',
                '7.5',
                '9007199254740992',
            ]) {
                await expect(
                    authenticate(sign({ sub })),
                ).rejects.toBeInstanceOf(UnauthorizedException);
            }
            const noExpiration = jwt.sign(
                { sub: '7' },
                { secret: config.secret },
            );
            await expect(authenticate(noExpiration)).rejects.toBeInstanceOf(
                UnauthorizedException,
            );
            expect(findById).not.toHaveBeenCalled();
        });

        it('requires its cookie and does not accept bearer, query or body tokens', async () => {
            const token = sign({ sub: '7' });
            for (const request of [
                {},
                { cookies: { [cookie]: {} } },
                { headers: { authorization: `Bearer ${token}` } },
                { query: { token } },
                { body: { token } },
            ]) {
                await expect(
                    guard.canActivate(contextFor(request)),
                ).rejects.toBeInstanceOf(UnauthorizedException);
            }
            expect(findById).not.toHaveBeenCalled();
        });
    });
});

describe('RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());
    const user = { userId: 7, role: UserRole.USER, status: UserStatus.ACTIVE };

    it('enforces class roles and method overrides without granting ADMIN USER-only access', () => {
        const admin = { ...user, role: UserRole.ADMIN };
        expect(guard.canActivate(contextFor({ user }))).toBe(false);
        expect(guard.canActivate(contextFor({ user: admin }))).toBe(true);
        expect(
            guard.canActivate(
                contextFor({ user }, ProtectedController.prototype.reader),
            ),
        ).toBe(true);
        expect(
            guard.canActivate(
                contextFor(
                    { user: admin },
                    ProtectedController.prototype.reader,
                ),
            ),
        ).toBe(false);
    });

    it('rejects unauthenticated requests when a role is required', () => {
        expect(() => guard.canActivate(contextFor({}))).toThrow(
            UnauthorizedException,
        );
    });
});

describe('AuthCookieService', () => {
    it.each([false, true])(
        'sets HttpOnly cookies with correct paths, TTLs and Secure=%s',
        (production) => {
            testEnvs.isProduction = production;
            const service = new AuthCookieService();
            const response = { cookie: vi.fn<Response['cookie']>() };
            service.setAccessToken(response, 'test-access');
            service.setRefreshToken(response, 'test-refresh');
            expect(response.cookie).toHaveBeenCalledWith(
                'access_token',
                'test-access',
                {
                    httpOnly: true,
                    secure: production,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 900000,
                },
            );
            expect(response.cookie).toHaveBeenCalledWith(
                'refresh_token',
                'test-refresh',
                {
                    httpOnly: true,
                    secure: production,
                    sameSite: 'lax',
                    path: '/auth/refresh',
                    maxAge: 604800000,
                },
            );
            testEnvs.isProduction = false;
        },
    );

    it('clears cookies using their original paths and flags without maxAge', () => {
        const response = { clearCookie: vi.fn<Response['clearCookie']>() };
        new AuthCookieService().clearTokens(response);
        expect(response.clearCookie).toHaveBeenCalledWith('access_token', {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
        });
        expect(response.clearCookie).toHaveBeenCalledWith('refresh_token', {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/auth/refresh',
        });
    });
});
