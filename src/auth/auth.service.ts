import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { CaptchaService } from '../captcha/captcha.service';
import { PasswordHasherService } from '../common/security/password-hasher.service';
import { envs } from '../config/envs';
import { EmailService } from '../email/email.service';
import { UserStatus } from '../users/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
    constructor(
        @InjectPinoLogger(AuthService.name)
        private readonly logger: PinoLogger,
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService,
        private readonly passwordHasher: PasswordHasherService,
        private readonly captchaService: CaptchaService,
        private readonly emailService: EmailService,

        @InjectRepository(PasswordResetToken)
        private readonly passwordResetTokensRepository: Repository<PasswordResetToken>,
    ) {}

    async register( registerDto: RegisterDto, ): Promise<{ message: string }> {
        this.logger.debug('Processing user registration');
        const captchaIsValid = await this.captchaService.verify(
            registerDto.captchaToken,
        );

        if (!captchaIsValid) {
            this.logger.warn('Registration rejected by CAPTCHA');
            throw new BadRequestException(
                'La verificación CAPTCHA no fue válida.',
            );
        }

        const existingUsername = await this.usersService.findByUsername(
            registerDto.username,
        );

        if (existingUsername) {
            this.logger.warn('Registration rejected: username already registered');
            throw new ConflictException(
                'El nombre de usuario ya está registrado.',
            );
        }

        const existingEmail = await this.usersService.findByEmail(
            registerDto.email,
        );

        if (existingEmail) {
            this.logger.warn('Registration rejected: email already registered');
            throw new ConflictException(
                'El correo electrónico ya está registrado.',
            );
        }

        const passwordHash = await this.passwordHasher.hash(
            registerDto.password,
        );

        await this.usersService.createRegisteredUser({
            username: registerDto.username,
            firstName: registerDto.firstName,
            middleName: registerDto.middleName ?? null,
            firstSurname: registerDto.firstSurname,
            secondSurname: registerDto.secondSurname ?? null,
            birthDate: registerDto.birthDate,
            email: registerDto.email,
            passwordHash,
        });

        this.logger.info('User registration completed');
        return {
            message: 'Usuario registrado correctamente.',
        };
    }

    async login(loginDto: LoginDto,): Promise<{ accessToken: string; refreshToken: string }> {
        this.logger.debug('Processing login');
        const user = await this.usersService.findByEmail(
            loginDto.email,
        );

        if (!user || user.status !== UserStatus.ACTIVE) {
            this.logger.warn('Login rejected: account unavailable');
            throw new UnauthorizedException(
                'Credenciales incorrectas.',
            );
        }

        const passwordMatches = await this.passwordHasher.verify(
            loginDto.password,
            user.passwordHash,
        );

        if (!passwordMatches) {
            this.logger.warn('Login rejected: invalid credentials');
            throw new UnauthorizedException(
                'Credenciales incorrectas.',
            );
        }

        const tokens = await this.signTokens(user.userId);
        this.logger.info({ userId: user.userId }, 'User authenticated successfully');
        return tokens;
    }

    async refresh( userId: number, ): Promise<{ accessToken: string; refreshToken: string }> {
        this.logger.debug({ userId }, 'Processing authentication renewal');
        const tokens = await this.signTokens(userId);
        this.logger.info({ userId }, 'Authentication renewed successfully');
        return tokens;
    }

    async forgotPassword(forgotPasswordDto: ForgotPasswordDto,): Promise<{ message: string }> {
        this.logger.debug('Processing password recovery request');
        const response = {
            message:
                'Si existe una cuenta asociada al correo electrónico, se enviarán instrucciones para restablecer la contraseña.',
        };

        const user = await this.usersService.findByEmail(
            forgotPasswordDto.email,
        );

        if (!user || user.status !== UserStatus.ACTIVE) {
            this.logger.info('Password recovery request processed');
            return response;
        }

        const token = randomBytes(32).toString('hex');
        const tokenHash = this.hashPasswordResetToken(token);

        const expiresAt = new Date(
            Date.now() +
                envs.passwordReset.tokenTtlMinutes * 60_000,
        );

        await this.passwordResetTokensRepository.manager.transaction(
            async (manager) => {
                const repository =
                    manager.getRepository(PasswordResetToken);

                await repository.delete({
                    userId: user.userId,
                });

                const resetToken = repository.create({
                    userId: user.userId,
                    tokenHash,
                    expiresAt,
                    usedAt: null,
                });

                await repository.save(resetToken);
            },
        );

        const frontendUrl = envs.frontendUrl.replace(/\/+$/, '');

        const resetUrl =
            `${frontendUrl}/reset-password` +
            `?token=${encodeURIComponent(token)}`;

        try {
            await this.emailService.sendPasswordReset(
                user.email,
                user.firstName,
                resetUrl,
            );
        } catch (error: unknown) {
            this.logger.error(
                { err: error },
                'Failed to send password reset email',
            );
        }

        this.logger.info('Password recovery request processed');
        return response;
    }

    async resetPassword( resetPasswordDto: ResetPasswordDto, ): Promise<{ message: string }> {
        this.logger.debug('Processing password reset');
        const tokenHash = this.hashPasswordResetToken(
            resetPasswordDto.token,
        );

        const passwordHash = await this.passwordHasher.hash(
            resetPasswordDto.newPassword,
        );

        const userId = await this.passwordResetTokensRepository.manager.transaction(
            async (manager) => {
                const repository =
                    manager.getRepository(PasswordResetToken);

                const resetToken = await repository
                    .createQueryBuilder('resetToken')
                    .setLock('pessimistic_write')
                    .where(
                        'resetToken.tokenHash = :tokenHash',
                        { tokenHash },
                    )
                    .getOne();

                if (
                    !resetToken ||
                    resetToken.usedAt !== null ||
                    resetToken.expiresAt.getTime() <= Date.now()
                ) {
                    this.logger.warn('Password reset rejected: invalid or expired recovery link');
                    throw new BadRequestException(
                        'El enlace de recuperación es inválido o ha expirado.',
                    );
                }

                const updated =
                    await this.usersService.updatePassword(
                        resetToken.userId,
                        passwordHash,
                        manager,
                    );

                if (!updated) {
                    this.logger.warn('Password reset rejected: invalid or expired recovery link');
                    throw new BadRequestException(
                        'El enlace de recuperación es inválido o ha expirado.',
                    );
                }

                resetToken.usedAt = new Date();

                await repository.save(resetToken);
                return resetToken.userId;
            },
        );

        this.logger.info({ userId }, 'Password reset completed successfully');
        return {
            message: 'Contraseña restablecida correctamente.',
        };
    }

    async changePassword( userId: number, changePasswordDto: ChangePasswordDto, ): Promise<{ message: string }> {
        this.logger.debug({ userId }, 'Processing password change');
        const user =
            await this.usersService.findByIdWithPassword(userId);

        if (!user || user.status !== UserStatus.ACTIVE) {
            this.logger.warn({ userId }, 'Password change rejected: account unavailable');
            throw new UnauthorizedException(
                'No autorizado.',
            );
        }

        const currentPasswordMatches =
            await this.passwordHasher.verify(
                changePasswordDto.currentPassword,
                user.passwordHash,
            );

        if (!currentPasswordMatches) {
            this.logger.warn({ userId }, 'Password change rejected: incorrect current password');
            throw new BadRequestException(
                'La contraseña actual es incorrecta.',
            );
        }

        const newPasswordMatches =
            await this.passwordHasher.verify(
                changePasswordDto.newPassword,
                user.passwordHash,
            );

        if (newPasswordMatches) {
            this.logger.warn({ userId }, 'Password change rejected: password reuse');
            throw new BadRequestException(
                'La nueva contraseña debe ser diferente de la actual.',
            );
        }

        const passwordHash = await this.passwordHasher.hash(
            changePasswordDto.newPassword,
        );

        const updated = await this.usersService.updatePassword(
            userId,
            passwordHash,
        );

        if (!updated) {
            this.logger.warn({ userId }, 'Password change rejected: account unavailable');
            throw new UnauthorizedException(
                'No autorizado.',
            );
        }

        this.logger.info({ userId }, 'Password changed successfully');
        return {
            message: 'Contraseña actualizada correctamente.',
        };
    }

    private hashPasswordResetToken(token: string): string {
        return createHash('sha256')
            .update(token)
            .digest('hex');
    }

    private async signTokens( userId: number, ): Promise<{ accessToken: string; refreshToken: string }> {
        const payload: JwtPayload = {
            sub: String(userId),
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: envs.jwt.access.secret,
                expiresIn: envs.jwt.access.expiresIn,
                algorithm: 'HS256',
            }),
            this.jwtService.signAsync(payload, {
                secret: envs.jwt.refresh.secret,
                expiresIn: envs.jwt.refresh.expiresIn,
                algorithm: 'HS256',
            }),
        ]);

        return {
            accessToken,
            refreshToken,
        };
    }
}
