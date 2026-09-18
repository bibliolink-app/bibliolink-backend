import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CaptchaModule } from '../captcha/captcha.module';
import { SecurityModule } from '../common/security/security.module';
import { envs } from '../config/envs';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthCookieService } from './cookies/auth-cookie.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshJwtAuthGuard } from './guards/refresh-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshJwtStrategy } from './strategies/refresh-jwt.strategy';

@Module({
    imports: [
        UsersModule,
        SecurityModule,
        CaptchaModule,
        EmailModule,
        TypeOrmModule.forFeature([PasswordResetToken]),
        PassportModule.register({ session: false }),
        JwtModule.register({
            secret: envs.jwt.access.secret,
            signOptions: {
                expiresIn: envs.jwt.access.expiresIn,
                algorithm: 'HS256',
            },
            verifyOptions: { algorithms: ['HS256'] },
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        AuthCookieService,
        JwtStrategy,
        RefreshJwtStrategy,
        JwtAuthGuard,
        RefreshJwtAuthGuard,
        RolesGuard,
    ],
    exports: [AuthCookieService, JwtAuthGuard, RefreshJwtAuthGuard, RolesGuard],
})
export class AuthModule {}
