"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const node_crypto_1 = require("node:crypto");
const typeorm_2 = require("typeorm");
const nestjs_pino_1 = require("nestjs-pino");
const captcha_service_1 = require("../captcha/captcha.service");
const password_hasher_service_1 = require("../common/security/password-hasher.service");
const envs_1 = require("../config/envs");
const email_service_1 = require("../email/email.service");
const user_status_enum_1 = require("../users/enums/user-status.enum");
const users_service_1 = require("../users/users.service");
const password_reset_token_entity_1 = require("./entities/password-reset-token.entity");
let AuthService = class AuthService {
    logger;
    jwtService;
    usersService;
    passwordHasher;
    captchaService;
    emailService;
    passwordResetTokensRepository;
    constructor(logger, jwtService, usersService, passwordHasher, captchaService, emailService, passwordResetTokensRepository) {
        this.logger = logger;
        this.jwtService = jwtService;
        this.usersService = usersService;
        this.passwordHasher = passwordHasher;
        this.captchaService = captchaService;
        this.emailService = emailService;
        this.passwordResetTokensRepository = passwordResetTokensRepository;
    }
    async register(registerDto) {
        this.logger.debug('Processing user registration');
        const captchaIsValid = await this.captchaService.verify(registerDto.captchaToken);
        if (!captchaIsValid) {
            this.logger.warn('Registration rejected by CAPTCHA');
            throw new common_1.BadRequestException('La verificación CAPTCHA no fue válida.');
        }
        const existingUsername = await this.usersService.findByUsername(registerDto.username);
        if (existingUsername) {
            this.logger.warn('Registration rejected: username already registered');
            throw new common_1.ConflictException('El nombre de usuario ya está registrado.');
        }
        const existingEmail = await this.usersService.findByEmail(registerDto.email);
        if (existingEmail) {
            this.logger.warn('Registration rejected: email already registered');
            throw new common_1.ConflictException('El correo electrónico ya está registrado.');
        }
        const passwordHash = await this.passwordHasher.hash(registerDto.password);
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
    async login(loginDto) {
        this.logger.debug('Processing login');
        const user = await this.usersService.findByEmail(loginDto.email);
        if (!user || user.status !== user_status_enum_1.UserStatus.ACTIVE) {
            this.logger.warn('Login rejected: account unavailable');
            throw new common_1.UnauthorizedException('Credenciales incorrectas.');
        }
        const passwordMatches = await this.passwordHasher.verify(loginDto.password, user.passwordHash);
        if (!passwordMatches) {
            this.logger.warn('Login rejected: invalid credentials');
            throw new common_1.UnauthorizedException('Credenciales incorrectas.');
        }
        const tokens = await this.signTokens(user.userId);
        this.logger.info({ userId: user.userId }, 'User authenticated successfully');
        return tokens;
    }
    async refresh(userId) {
        this.logger.debug({ userId }, 'Processing authentication renewal');
        const tokens = await this.signTokens(userId);
        this.logger.info({ userId }, 'Authentication renewed successfully');
        return tokens;
    }
    async forgotPassword(forgotPasswordDto) {
        this.logger.debug('Processing password recovery request');
        const response = {
            message: 'Si existe una cuenta asociada al correo electrónico, se enviarán instrucciones para restablecer la contraseña.',
        };
        const user = await this.usersService.findByEmail(forgotPasswordDto.email);
        if (!user || user.status !== user_status_enum_1.UserStatus.ACTIVE) {
            this.logger.info('Password recovery request processed');
            return response;
        }
        const token = (0, node_crypto_1.randomBytes)(32).toString('hex');
        const tokenHash = this.hashPasswordResetToken(token);
        const expiresAt = new Date(Date.now() +
            envs_1.envs.passwordReset.tokenTtlMinutes * 60_000);
        await this.passwordResetTokensRepository.manager.transaction(async (manager) => {
            const repository = manager.getRepository(password_reset_token_entity_1.PasswordResetToken);
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
        });
        const frontendUrl = envs_1.envs.frontendUrl.replace(/\/+$/, '');
        const resetUrl = `${frontendUrl}/reset-password` +
            `?token=${encodeURIComponent(token)}`;
        try {
            await this.emailService.sendPasswordReset(user.email, user.firstName, resetUrl);
        }
        catch (error) {
            this.logger.error({ err: error }, 'Failed to send password reset email');
        }
        this.logger.info('Password recovery request processed');
        return response;
    }
    async resetPassword(resetPasswordDto) {
        this.logger.debug('Processing password reset');
        const tokenHash = this.hashPasswordResetToken(resetPasswordDto.token);
        const passwordHash = await this.passwordHasher.hash(resetPasswordDto.newPassword);
        const userId = await this.passwordResetTokensRepository.manager.transaction(async (manager) => {
            const repository = manager.getRepository(password_reset_token_entity_1.PasswordResetToken);
            const resetToken = await repository
                .createQueryBuilder('resetToken')
                .setLock('pessimistic_write')
                .where('resetToken.tokenHash = :tokenHash', { tokenHash })
                .getOne();
            if (!resetToken ||
                resetToken.usedAt !== null ||
                resetToken.expiresAt.getTime() <= Date.now()) {
                this.logger.warn('Password reset rejected: invalid or expired recovery link');
                throw new common_1.BadRequestException('El enlace de recuperación es inválido o ha expirado.');
            }
            const updated = await this.usersService.updatePassword(resetToken.userId, passwordHash, manager);
            if (!updated) {
                this.logger.warn('Password reset rejected: invalid or expired recovery link');
                throw new common_1.BadRequestException('El enlace de recuperación es inválido o ha expirado.');
            }
            resetToken.usedAt = new Date();
            await repository.save(resetToken);
            return resetToken.userId;
        });
        this.logger.info({ userId }, 'Password reset completed successfully');
        return {
            message: 'Contraseña restablecida correctamente.',
        };
    }
    async changePassword(userId, changePasswordDto) {
        this.logger.debug({ userId }, 'Processing password change');
        const user = await this.usersService.findByIdWithPassword(userId);
        if (!user || user.status !== user_status_enum_1.UserStatus.ACTIVE) {
            this.logger.warn({ userId }, 'Password change rejected: account unavailable');
            throw new common_1.UnauthorizedException('No autorizado.');
        }
        const currentPasswordMatches = await this.passwordHasher.verify(changePasswordDto.currentPassword, user.passwordHash);
        if (!currentPasswordMatches) {
            this.logger.warn({ userId }, 'Password change rejected: incorrect current password');
            throw new common_1.BadRequestException('La contraseña actual es incorrecta.');
        }
        const newPasswordMatches = await this.passwordHasher.verify(changePasswordDto.newPassword, user.passwordHash);
        if (newPasswordMatches) {
            this.logger.warn({ userId }, 'Password change rejected: password reuse');
            throw new common_1.BadRequestException('La nueva contraseña debe ser diferente de la actual.');
        }
        const passwordHash = await this.passwordHasher.hash(changePasswordDto.newPassword);
        const updated = await this.usersService.updatePassword(userId, passwordHash);
        if (!updated) {
            this.logger.warn({ userId }, 'Password change rejected: account unavailable');
            throw new common_1.UnauthorizedException('No autorizado.');
        }
        this.logger.info({ userId }, 'Password changed successfully');
        return {
            message: 'Contraseña actualizada correctamente.',
        };
    }
    hashPasswordResetToken(token) {
        return (0, node_crypto_1.createHash)('sha256')
            .update(token)
            .digest('hex');
    }
    async signTokens(userId) {
        const payload = {
            sub: String(userId),
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: envs_1.envs.jwt.access.secret,
                expiresIn: envs_1.envs.jwt.access.expiresIn,
                algorithm: 'HS256',
            }),
            this.jwtService.signAsync(payload, {
                secret: envs_1.envs.jwt.refresh.secret,
                expiresIn: envs_1.envs.jwt.refresh.expiresIn,
                algorithm: 'HS256',
            }),
        ]);
        return {
            accessToken,
            refreshToken,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, nestjs_pino_1.InjectPinoLogger)(AuthService.name)),
    __param(6, (0, typeorm_1.InjectRepository)(password_reset_token_entity_1.PasswordResetToken)),
    __metadata("design:paramtypes", [nestjs_pino_1.PinoLogger,
        jwt_1.JwtService,
        users_service_1.UsersService,
        password_hasher_service_1.PasswordHasherService,
        captcha_service_1.CaptchaService,
        email_service_1.EmailService,
        typeorm_2.Repository])
], AuthService);
//# sourceMappingURL=auth.service.js.map