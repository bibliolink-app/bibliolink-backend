import 'reflect-metadata';
import { NotFoundException, ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { createHash } from 'node:crypto';
import { getLoggerToken } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CaptchaService } from '../captcha/captcha.service';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { PasswordHasherService } from '../common/security/password-hasher.service';
import { EmailService } from '../email/email.service';
import { SUPPORTED_LANGUAGES, type Language } from '../i18n/i18n.constants';
import { createValidationException } from '../i18n/localized-validation';
import { MESSAGES, type MessageCode } from '../i18n/messages';
import { translate } from '../i18n/translate';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieService } from './cookies/auth-cookie.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshJwtStrategy } from './strategies/refresh-jwt.strategy';

const config = vi.hoisted(() => ({
    isProduction: false,
    frontendUrl: 'https://bibliolink.example.test',
    jwt: {
        access: { secret: 'i18n-test-access-secret-at-least-32-characters', expiresIn: 900 },
        refresh: { secret: 'i18n-test-refresh-secret-at-least-32-characters', expiresIn: 604800 },
    },
    cookies: { authMaxAge: 900000, refreshMaxAge: 604800000 },
    passwordHash: { rounds: 4 },
    passwordReset: { tokenTtlMinutes: 30 },
    throttling: {
        register: { ttl: 60000, limit: 100 }, login: { ttl: 60000, limit: 100 },
        forgotPassword: { ttl: 60000, limit: 100 }, resetPassword: { ttl: 60000, limit: 100 },
    },
}));
vi.mock('../config/envs', () => ({ envs: config }));

describe('Auth internationalization over HTTP', () => {
    let app: INestApplication<App>;
    const jwt = new JwtService();
    const hasher = new PasswordHasherService();
    const password = 'Private-password1!';
    const newPassword = 'New-private-password2!';
    let user: User;
    const users = {
        findByEmail: vi.fn<UsersService['findByEmail']>(),
        findByUsername: vi.fn<UsersService['findByUsername']>(),
        findById: vi.fn<UsersService['findById']>(),
        findByIdWithPassword: vi.fn<UsersService['findByIdWithPassword']>(),
        createRegisteredUser: vi.fn<UsersService['createRegisteredUser']>(),
        updatePassword: vi.fn<UsersService['updatePassword']>(),
    };
    const captcha = { verify: vi.fn<CaptchaService['verify']>() };
    const email = { sendPasswordReset: vi.fn<EmailService['sendPasswordReset']>() };
    const query = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn<() => Promise<PasswordResetToken | null>>(),
    };
    const repository = {
        delete: vi.fn(async () => ({ affected: 1 })),
        create: vi.fn((token: Partial<PasswordResetToken>) => token),
        save: vi.fn(async (token: Partial<PasswordResetToken>) => token),
        createQueryBuilder: vi.fn(() => query),
    };
    const manager = { getRepository: vi.fn(() => repository) };
    const transaction = vi.fn(async (work: (value: typeof manager) => Promise<unknown>) => work(manager));
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const registration = {
        username: 'reader', firstName: 'Test', firstSurname: 'Reader',
        birthDate: '2000-01-01', email: 'reader@example.test', password, captchaToken: 'private-captcha',
    };
    const accessCookie = () => `access_token=${jwt.sign({ sub: '7' }, config.jwt.access)}`;
    const validReset = () => Object.assign(new PasswordResetToken(), {
        passwordResetTokenId: 1, userId: 7, tokenHash: 'stored-hash',
        expiresAt: new Date(Date.now() + 60000), usedAt: null, createdAt: new Date(),
    });

    beforeAll(async () => {
        user = Object.assign(new User(), {
            userId: 7, ...registration, middleName: null, secondSurname: null,
            role: UserRole.USER, status: UserStatus.ACTIVE, passwordHash: await hasher.hash(password),
            createdAt: new Date(), updatedAt: new Date(),
        });
        // Vitest no emite design:paramtypes; las fronteras se sustituyen sin alterar Auth.
        Reflect.defineMetadata('design:paramtypes', [AuthService, AuthCookieService], AuthController);
        Reflect.defineMetadata('design:paramtypes', [Object, JwtService, UsersService, PasswordHasherService, CaptchaService, EmailService, Object], AuthService);
        for (const [method, params] of [
            ['register', [RegisterDto, Object]], ['login', [LoginDto, Object, Object]],
            ['forgotPassword', [ForgotPasswordDto, Object]], ['resetPassword', [ResetPasswordDto, Object]],
            ['changePassword', [Object, ChangePasswordDto, Object]],
        ] as const) {
            Reflect.defineMetadata('design:paramtypes', params, AuthController.prototype, method);
        }
        const module = await Test.createTestingModule({
            imports: [PassportModule.register({ session: false })],
            controllers: [AuthController],
            providers: [
                AuthService, AuthCookieService,
                { provide: JwtService, useValue: jwt },
                { provide: PasswordHasherService, useValue: hasher },
                { provide: UsersService, useValue: users },
                { provide: CaptchaService, useValue: captcha },
                { provide: EmailService, useValue: email },
                { provide: getLoggerToken(AuthService.name), useValue: logger },
                { provide: getRepositoryToken(PasswordResetToken), useValue: { manager: { transaction } } },
                { provide: JwtStrategy, useFactory: (service: UsersService) => new JwtStrategy(service), inject: [UsersService] },
                { provide: RefreshJwtStrategy, useFactory: (service: UsersService) => new RefreshJwtStrategy(service), inject: [UsersService] },
            ],
        }).compile();
        app = module.createNestApplication();
        app.use(cookieParser());
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true, forbidNonWhitelisted: true, transform: true,
            exceptionFactory: createValidationException,
        }));
        app.useGlobalFilters(new HttpExceptionFilter());
        await app.init();
    });

    afterAll(async () => { await app?.close(); });
    beforeEach(() => {
        vi.clearAllMocks();
        config.isProduction = false;
        users.findByEmail.mockReset().mockResolvedValue(user);
        users.findByUsername.mockReset().mockResolvedValue(null);
        users.findById.mockReset().mockResolvedValue(user);
        users.findByIdWithPassword.mockReset().mockResolvedValue(user);
        users.createRegisteredUser.mockReset().mockResolvedValue(undefined);
        users.updatePassword.mockReset().mockResolvedValue(true);
        captcha.verify.mockReset().mockResolvedValue(true);
        email.sendPasswordReset.mockReset().mockResolvedValue(undefined);
        query.getOne.mockReset().mockResolvedValue(null);
    });

    function expectError(response: request.Response, status: number, code: MessageCode, language: Language, path: string) {
        expect(response.status).toBe(status);
        expect(response.body).toEqual({
            statusCode: status, code, message: MESSAGES[language][code],
            error: status === 401 ? 'UNAUTHORIZED' : status === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            path, timestamp: expect.any(String),
        });
        expect(response.headers['set-cookie']).toBeUndefined();
        for (const secret of [password, newPassword, user.passwordHash, 'private-reset-token', registration.captchaToken]) {
            expect(response.text).not.toContain(secret);
        }
    }

    function checkCookies(response: request.Response, production: boolean) {
        const cookies: unknown = response.headers['set-cookie'];
        if (!Array.isArray(cookies) || !cookies.every((cookie): cookie is string => typeof cookie === 'string')) {
            throw new Error('Expected authentication cookies');
        }
        expect(cookies).toHaveLength(2);
        for (const [index, kind, name, path] of [
            [0, 'access', 'access_token', '/'], [1, 'refresh', 'refresh_token', '/auth/refresh'],
        ] as const) {
            const cookie = cookies[index];
            expect(cookie).toContain(`${name}=`);
            expect(cookie).toContain(`Path=${path};`);
            expect(cookie).toContain('HttpOnly');
            expect(cookie).toContain(`SameSite=${production ? 'None' : 'Lax'}`);
            expect(cookie.includes('; Secure')).toBe(production);
            expect(cookie).toContain(`Max-Age=${config.jwt[kind].expiresIn}`);
            const token = cookie.split(';')[0].slice(name.length + 1);
            const payload = jwt.verify<{ sub: string; iat: number; exp: number }>(token, {
                secret: config.jwt[kind].secret, algorithms: ['HS256'],
            });
            expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
            expect(payload.sub).toBe('7');
            expect(payload.exp - payload.iat).toBe(config.jwt[kind].expiresIn);
            expect(response.text).not.toContain(token);
        }
    }

    describe.each(SUPPORTED_LANGUAGES)('Accept-Language: %s', (language) => {
        const post = (path: string) => request(app.getHttpServer()).post(`/auth/${path}`).set('Accept-Language', language);

        it('rejects invalid registration fields with translated validation details before CAPTCHA', async () => {
            const response = await post('register').send({ ...registration, username: 'x'.repeat(26), email: 'invalid', password: 'weak', role: 'ADMIN' }).expect(400);
            expect(response.body).toEqual({
                statusCode: 400, code: 'VALIDATION_FAILED', error: 'BAD_REQUEST', path: '/auth/register',
                timestamp: expect.any(String), message: expect.any(Array), details: expect.any(Array),
            });
            for (const [field, code, params] of [
                ['username', 'VALIDATION_USERNAME_MAX_LENGTH', { max: 25 }],
                ['email', 'VALIDATION_EMAIL_FORMAT', {}],
                ['password', 'VALIDATION_STRONG_PASSWORD', {}],
                ['role', 'VALIDATION_PROPERTY_NOT_ALLOWED', { property: 'role' }],
            ] as const) {
                const message = translate(code, language, params);
                expect(response.body.details).toContainEqual({ field, code, message });
                expect(response.body.message).toContain(message);
            }
            expect(captcha.verify).not.toHaveBeenCalled();
            expect(users.createRegisteredUser).not.toHaveBeenCalled();
        });

        it.each([
            { path: 'register', body: { ...registration, firstName: '' }, field: 'firstName', code: 'VALIDATION_FIRST_NAME_REQUIRED' },
            { path: 'register', body: { ...registration, middleName: 123 }, field: 'middleName', code: 'VALIDATION_MIDDLE_NAME_STRING' },
            { path: 'register', body: { ...registration, captchaToken: '' }, field: 'captchaToken', code: 'VALIDATION_CAPTCHA_TOKEN_REQUIRED' },
            { path: 'login', body: { email: 'invalid', password }, field: 'email', code: 'VALIDATION_EMAIL_FORMAT' },
            { path: 'login', body: { email: registration.email, password: '' }, field: 'password', code: 'VALIDATION_PASSWORD_REQUIRED' },
            { path: 'forgot-password', body: { email: 'invalid' }, field: 'email', code: 'VALIDATION_EMAIL_FORMAT' },
            { path: 'reset-password', body: { token: 123, newPassword }, field: 'token', code: 'VALIDATION_RESET_TOKEN_STRING' },
            { path: 'reset-password', body: { token: '', newPassword }, field: 'token', code: 'VALIDATION_RESET_TOKEN_REQUIRED' },
            { path: 'reset-password', body: { token: 'x'.repeat(65), newPassword }, field: 'token', code: 'VALIDATION_RESET_TOKEN_MAX_LENGTH' },
            { path: 'change-password', body: { currentPassword: '', newPassword }, field: 'currentPassword', code: 'VALIDATION_CURRENT_PASSWORD_REQUIRED' },
            { path: 'change-password', body: { currentPassword: password, newPassword: 123 }, field: 'newPassword', code: 'VALIDATION_NEW_PASSWORD_STRING' },
        ] as const)('localizes $path DTO validation: $code', async ({ path, body, field, code }) => {
            const call = path === 'change-password'
                ? request(app.getHttpServer()).patch('/auth/change-password').set('Accept-Language', language).set('Cookie', accessCookie())
                : post(path);
            const response = await call.send(body).expect(400);
            expect(response.body.code).toBe('VALIDATION_FAILED');
            expect(response.body.details).toContainEqual({ field, code, message: MESSAGES[language][code] });
            expect(response.body.message).toContain(MESSAGES[language][code]);
            expect(captcha.verify).not.toHaveBeenCalled();
            expect(users.findByEmail).not.toHaveBeenCalled();
            expect(users.findByIdWithPassword).not.toHaveBeenCalled();
            expect(transaction).not.toHaveBeenCalled();
            expect(response.headers['set-cookie']).toBeUndefined();
        });

        it.each(['email', 'username', 'captcha'] as const)('localizes registration rejection: %s', async (reason) => {
            if (reason === 'username') users.findByUsername.mockResolvedValue(user);
            if (reason === 'captcha') captcha.verify.mockResolvedValue(false);
            const response = await post('register').send(registration);
            const code = { email: 'AUTH_EMAIL_ALREADY_REGISTERED', username: 'AUTH_USERNAME_ALREADY_REGISTERED', captcha: 'AUTH_CAPTCHA_INVALID' } as const;
            expectError(response, reason === 'captcha' ? 400 : 409, code[reason], language, '/auth/register');
            expect(users.createRegisteredUser).not.toHaveBeenCalled();
        });

        it('registers with the same 201 response and password hashing', async () => {
            users.findByEmail.mockResolvedValue(null);
            const response = await post('register').send(registration).expect(201, { message: MESSAGES[language].AUTH_REGISTERED });
            expect(response.headers['set-cookie']).toBeUndefined();
            expect(captcha.verify).toHaveBeenCalledWith(registration.captchaToken);
            const input = users.createRegisteredUser.mock.calls[0][0];
            expect(input).toEqual({
                username: registration.username, firstName: registration.firstName, firstSurname: registration.firstSurname,
                middleName: null, secondSurname: null, birthDate: registration.birthDate, email: registration.email,
                passwordHash: expect.any(String),
            });
            expect(await hasher.verify(password, input.passwordHash)).toBe(true);
        });

        it.each(['missing', 'inactive', 'wrong-password'] as const)('keeps login failures equivalent: %s', async (reason) => {
            if (reason === 'missing') users.findByEmail.mockResolvedValue(null);
            if (reason === 'inactive') users.findByEmail.mockResolvedValue({ ...user, status: UserStatus.INACTIVE });
            const response = await post('login').send({ email: user.email, password: 'incorrect-password' });
            expectError(response, 401, 'AUTH_INVALID_CREDENTIALS', language, '/auth/login');
        });

        it.each([false, true])('preserves signed tokens and cookie settings, production=%s', async (production) => {
            config.isProduction = production;
            const response = await post('login').send({ email: user.email, password }).expect(200, { message: MESSAGES[language].AUTH_LOGGED_IN });
            expect(response.headers['cache-control']).toBe('no-store');
            checkCookies(response, production);
        });

        it.each(['missing', 'inactive', 'active', 'email-failure'] as const)('keeps recovery non-enumerating: %s', async (state) => {
            if (state === 'missing') users.findByEmail.mockResolvedValue(null);
            if (state === 'inactive') users.findByEmail.mockResolvedValue({ ...user, status: UserStatus.INACTIVE });
            if (state === 'email-failure') email.sendPasswordReset.mockRejectedValue(new Error('Provider unavailable'));
            const response = await post('forgot-password').send({ email: user.email })
                .expect(200, { message: MESSAGES[language].AUTH_PASSWORD_RESET_REQUESTED });
            expect(response.headers['set-cookie']).toBeUndefined();
            if (state === 'missing' || state === 'inactive') {
                expect(transaction).not.toHaveBeenCalled();
                expect(email.sendPasswordReset).not.toHaveBeenCalled();
            } else {
                expect(transaction).toHaveBeenCalledTimes(1);
                const [to, name, url, emailLanguage] = email.sendPasswordReset.mock.calls[0];
                expect(emailLanguage).toBe(language);
                expect(to).toBe(user.email);
                expect(name).toBe(user.firstName);
                const resetUrl = new URL(url);
                expect(resetUrl.origin + resetUrl.pathname).toBe(`${config.frontendUrl}/reset-password`);
                const token = resetUrl.searchParams.get('token');
                expect(token).toMatch(/^[a-f0-9]{64}$/);
                if (!token) throw new Error('Expected reset token');
                expect(repository.save.mock.calls[0][0]).toMatchObject({
                    userId: 7, usedAt: null, tokenHash: createHash('sha256').update(token).digest('hex'),
                    expiresAt: expect.any(Date),
                });
                expect(response.text).not.toContain(token);
                expect(email.sendPasswordReset.mock.calls[0]).toHaveLength(4);
            }
        });

        it.each(['invalid', 'expired', 'used', 'unavailable-account'] as const)('keeps recovery-token rejections equivalent: %s', async (state) => {
            const token = validReset();
            if (state === 'expired') token.expiresAt = new Date(0);
            if (state === 'used') token.usedAt = new Date();
            if (state !== 'invalid') query.getOne.mockResolvedValue(token);
            if (state === 'unavailable-account') users.updatePassword.mockResolvedValue(false);
            const response = await post('reset-password').send({ token: 'private-reset-token', newPassword });
            expectError(response, 400, 'AUTH_PASSWORD_RESET_INVALID', language, '/auth/reset-password');
            expect(repository.save).not.toHaveBeenCalled();
            if (state !== 'unavailable-account') expect(users.updatePassword).not.toHaveBeenCalled();
        });

        it('resets the password and consumes the token in the same transaction', async () => {
            const token = validReset();
            query.getOne.mockResolvedValue(token);
            await post('reset-password').send({ token: 'private-reset-token', newPassword })
                .expect(200, { message: MESSAGES[language].AUTH_PASSWORD_RESET });
            expect(transaction).toHaveBeenCalledTimes(1);
            expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
            expect(query.where).toHaveBeenCalledWith('resetToken.tokenHash = :tokenHash', {
                tokenHash: createHash('sha256').update('private-reset-token').digest('hex'),
            });
            const [id, hash, context] = users.updatePassword.mock.calls[0];
            expect(id).toBe(7);
            expect(context).toBe(manager);
            expect(await hasher.verify(newPassword, hash)).toBe(true);
            expect(token.usedAt).toBeInstanceOf(Date);
            expect(repository.save).toHaveBeenCalledWith(token);
        });

        it.each(['wrong-current', 'reuse', 'missing', 'inactive', 'update-rejected'] as const)('preserves password-change rejection: %s', async (state) => {
            if (state === 'missing') users.findByIdWithPassword.mockResolvedValue(null);
            if (state === 'inactive') users.findByIdWithPassword.mockResolvedValue({ ...user, status: UserStatus.INACTIVE });
            if (state === 'update-rejected') users.updatePassword.mockResolvedValue(false);
            const response = await request(app.getHttpServer()).patch('/auth/change-password')
                .set('Accept-Language', language).set('Cookie', accessCookie()).send({
                    currentPassword: state === 'wrong-current' ? 'incorrect' : password,
                    newPassword: state === 'reuse' ? password : newPassword,
                });
            const unauthorized = ['missing', 'inactive', 'update-rejected'].includes(state);
            expectError(response, unauthorized ? 401 : 400,
                unauthorized ? 'AUTH_UNAUTHORIZED' : state === 'reuse' ? 'AUTH_PASSWORD_REUSE' : 'AUTH_CURRENT_PASSWORD_INCORRECT',
                language, '/auth/change-password');
        });

        it('changes the password without changing cookies or the success contract', async () => {
            const response = await request(app.getHttpServer()).patch('/auth/change-password')
                .set('Accept-Language', language).set('Cookie', accessCookie()).send({ currentPassword: password, newPassword })
                .expect(200, { message: MESSAGES[language].AUTH_PASSWORD_CHANGED });
            expect(response.headers['set-cookie']).toBeUndefined();
            const [id, hash] = users.updatePassword.mock.calls[0];
            expect(id).toBe(7);
            expect(await hasher.verify(newPassword, hash)).toBe(true);
        });

        it('refreshes and logs out with the existing cookie paths and cache headers', async () => {
            const refreshToken = jwt.sign({ sub: '7' }, config.jwt.refresh);
            const refreshed = await post('refresh').set('Cookie', `refresh_token=${refreshToken}`)
                .expect(200, { message: MESSAGES[language].AUTH_REFRESHED });
            expect(refreshed.headers['cache-control']).toBe('no-store');
            checkCookies(refreshed, false);
            const logout = await post('logout').expect(200, { message: MESSAGES[language].AUTH_LOGGED_OUT });
            expect(logout.headers['cache-control']).toBe('no-store');
            expect(logout.headers['set-cookie']).toEqual([
                'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
                'refresh_token=; Path=/auth/refresh; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
            ]);
        });

        it('leaves the me response and guard denials independent of language', async () => {
            await request(app.getHttpServer()).get('/auth/me').set('Accept-Language', language).set('Cookie', accessCookie())
                .expect(200, { userId: 7, role: UserRole.USER, status: UserStatus.ACTIVE });
            for (const token of ['invalid', jwt.sign({ sub: '7' }, { ...config.jwt.access, expiresIn: -1 })]) {
                const response = await request(app.getHttpServer()).get('/auth/me')
                    .set('Accept-Language', language).set('Cookie', `access_token=${token}`).expect(401);
                expectError(response, 401, 'AUTH_UNAUTHORIZED', language, '/auth/me');
            }
            users.findById.mockRejectedValue(new NotFoundException());
            await request(app.getHttpServer()).get('/auth/me').set('Accept-Language', language).set('Cookie', accessCookie()).expect(401);
        });
    });

    it.each([undefined, 'de'])('uses Spanish for unsupported or absent language: %s', async (language) => {
        const call = request(app.getHttpServer()).post('/auth/forgot-password');
        if (language) call.set('Accept-Language', language);
        users.findByEmail.mockResolvedValue(null);
        await call.send({ email: user.email }).expect(200, { message: MESSAGES.es.AUTH_PASSWORD_RESET_REQUESTED });
    });
});
