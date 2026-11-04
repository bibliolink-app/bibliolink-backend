import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Post, Res, UseGuards, } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import type { Language } from '../i18n/i18n.constants';
import { RequestLanguage } from '../i18n/request-language.decorator';
import { translate } from '../i18n/translate';
import { envs } from '../config/envs';
import { AuthService } from './auth.service';
import { AuthCookieService } from './cookies/auth-cookie.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshJwtAuthGuard } from './guards/refresh-jwt-auth.guard';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly authCookieService: AuthCookieService,
    ) {}

    @Post('register')
    @Throttle({ default: envs.throttling.register })
    async register(@Body() registerDto: RegisterDto, @RequestLanguage() language: Language): Promise<{ message: string }> {
        await this.authService.register(registerDto);
        return { message: translate('AUTH_REGISTERED', language) };
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    @Throttle({ default: envs.throttling.login })
    async login( @Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response, @RequestLanguage() language: Language, ): Promise<{ message: string }> {
        const tokens = await this.authService.login(loginDto);

        this.authCookieService.setAccessToken(
            response,
            tokens.accessToken,
        );

        this.authCookieService.setRefreshToken(
            response,
            tokens.refreshToken,
        );

        return {
            message: translate('AUTH_LOGGED_IN', language),
        };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    @UseGuards(RefreshJwtAuthGuard)
    async refresh( @CurrentUser() currentUser: AuthenticatedUser, @Res({ passthrough: true }) response: Response, @RequestLanguage() language: Language, ): Promise<{ message: string }> {
        const tokens = await this.authService.refresh(
            currentUser.userId,
        );

        this.authCookieService.setAccessToken(
            response,
            tokens.accessToken,
        );

        this.authCookieService.setRefreshToken(
            response,
            tokens.refreshToken,
        );

        return {
            message: translate('AUTH_REFRESHED', language),
        };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    logout(@Res({ passthrough: true }) response: Response, @RequestLanguage() language: Language,): { message: string } {
        this.authCookieService.clearTokens(response);

        return {
            message: translate('AUTH_LOGGED_OUT', language),
        };
    }

    @Get('me')
    @Header('Cache-Control', 'no-store')
    @UseGuards(JwtAuthGuard)
    getMe(@CurrentUser() currentUser: AuthenticatedUser,): AuthUserResponseDto {
        return {
            userId: currentUser.userId,
            role: currentUser.role,
            status: currentUser.status,
        };
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    @Throttle({default: envs.throttling.forgotPassword,})
    async forgotPassword( @Body() forgotPasswordDto: ForgotPasswordDto, @RequestLanguage() language: Language, ): Promise<{ message: string }> {
        await this.authService.forgotPassword(
            forgotPasswordDto,
            language,
        );
        return { message: translate('AUTH_PASSWORD_RESET_REQUESTED', language) };
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    @Throttle({default: envs.throttling.resetPassword,})
    async resetPassword( @Body() resetPasswordDto: ResetPasswordDto, @RequestLanguage() language: Language, ): Promise<{ message: string }> {
        await this.authService.resetPassword(
            resetPasswordDto,
        );
        return { message: translate('AUTH_PASSWORD_RESET', language) };
    }

    @Patch('change-password')
    @Header('Cache-Control', 'no-store')
    @UseGuards(JwtAuthGuard)
    async changePassword( @CurrentUser() currentUser: AuthenticatedUser, @Body() changePasswordDto: ChangePasswordDto, @RequestLanguage() language: Language, ): Promise<{ message: string }> {
        await this.authService.changePassword(
            currentUser.userId,
            changePasswordDto,
        );
        return { message: translate('AUTH_PASSWORD_CHANGED', language) };
    }
}
