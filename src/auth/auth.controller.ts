import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Post, Res, UseGuards, } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

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
    register(@Body() registerDto: RegisterDto,): Promise<{ message: string }> {
        return this.authService.register(registerDto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    @Throttle({ default: envs.throttling.login })
    async login( @Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response, ): Promise<{ message: string }> {
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
            message: 'Sesión iniciada correctamente.',
        };
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    @UseGuards(RefreshJwtAuthGuard)
    async refresh( @CurrentUser() currentUser: AuthenticatedUser, @Res({ passthrough: true }) response: Response, ): Promise<{ message: string }> {
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
            message: 'Autenticación renovada correctamente.',
        };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    logout(@Res({ passthrough: true }) response: Response,): { message: string } {
        this.authCookieService.clearTokens(response);

        return {
            message: 'Sesión cerrada correctamente.',
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
    forgotPassword( @Body() forgotPasswordDto: ForgotPasswordDto, ): Promise<{ message: string }> {
        return this.authService.forgotPassword(
            forgotPasswordDto,
        );
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @Header('Cache-Control', 'no-store')
    @Throttle({default: envs.throttling.resetPassword,})
    resetPassword( @Body() resetPasswordDto: ResetPasswordDto, ): Promise<{ message: string }> {
        return this.authService.resetPassword(
            resetPasswordDto,
        );
    }

    @Patch('change-password')
    @Header('Cache-Control', 'no-store')
    @UseGuards(JwtAuthGuard)
    changePassword( @CurrentUser() currentUser: AuthenticatedUser, @Body() changePasswordDto: ChangePasswordDto, ): Promise<{ message: string }> {
        return this.authService.changePassword(
            currentUser.userId,
            changePasswordDto,
        );
    }
}