import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';

import { envs } from '../../config/envs';

const cookies = {
    access: { name: 'access_token', path: '/' },
    refresh: { name: 'refresh_token', path: '/auth/refresh' },
} as const;

@Injectable()
export class AuthCookieService {
    setAccessToken(response: Pick<Response, 'cookie'>, token: string): void {
        response.cookie(cookies.access.name, token, {
            ...this.options('access'),
            maxAge: envs.cookies.authMaxAge,
        });
    }

    setRefreshToken(response: Pick<Response, 'cookie'>, token: string): void {
        response.cookie(cookies.refresh.name, token, {
            ...this.options('refresh'),
            maxAge: envs.cookies.refreshMaxAge,
        });
    }

    clearTokens(response: Pick<Response, 'clearCookie'>): void {
        response.clearCookie(cookies.access.name, this.options('access'));
        response.clearCookie(cookies.refresh.name, this.options('refresh'));
    }

    private options(kind: keyof typeof cookies): CookieOptions {
        return {
            httpOnly: true,
            secure: envs.isProduction,
            sameSite: 'lax',
            path: cookies[kind].path,
        };
    }
}