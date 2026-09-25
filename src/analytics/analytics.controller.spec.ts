import 'reflect-metadata';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { UsersService } from '../users/users.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { RegistrationsQueryDto } from './dto/registrations-query.dto';

const config = vi.hoisted(() => ({
    jwt: { access: { secret: 'analytics-test-secret-at-least-32-characters' } },
}));
vi.mock('../config/envs', () => ({ envs: config }));

describe('Analytics HTTP authorization and validation', () => {
    let app: INestApplication<App>;
    const jwt = new JwtService();
    const findById = vi.fn<UsersService['findById']>();
    const summary = vi.fn<AnalyticsService['getSummary']>();
    const registrations = vi.fn<AnalyticsService['getRegistrationsByPeriod']>();
    const user = {
        userId: 1, username: 'admin', firstName: 'Test', middleName: null,
        firstSurname: 'Admin', secondSurname: null, birthDate: '2000-01-01',
        email: 'admin@example.test', role: UserRole.ADMIN,
        status: UserStatus.ACTIVE, createdAt: new Date(),
    };
    const cookie = () => `access_token=${jwt.sign({ sub: '1' }, {
        secret: config.jwt.access.secret, expiresIn: 60, algorithm: 'HS256',
    })}`;

    beforeAll(async () => {
        // Vitest no emite design:paramtypes; Nest/tsc sí lo hace en el build.
        Reflect.defineMetadata('design:paramtypes', [AnalyticsService], AnalyticsController);
        Reflect.defineMetadata('design:paramtypes', [RegistrationsQueryDto],
            AnalyticsController.prototype, 'getRegistrationsByPeriod');
        const module = await Test.createTestingModule({
            imports: [PassportModule.register({ session: false })],
            controllers: [AnalyticsController],
            providers: [
                { provide: AnalyticsService, useValue: {
                    getSummary: summary, getRegistrationsByPeriod: registrations,
                } },
                { provide: UsersService, useValue: { findById } },
            ],
        }).overrideGuard(RolesGuard).useValue(new RolesGuard(new Reflector())).compile();
        new JwtStrategy(module.get(UsersService));
        app = module.createNestApplication();
        app.use(cookieParser());
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true, forbidNonWhitelisted: true, transform: true,
        }));
        await app.init();
    });

    afterAll(async () => { await app?.close(); });
    beforeEach(() => {
        findById.mockReset().mockResolvedValue(user);
        summary.mockReset().mockResolvedValue({ totalUsers: 4, premiumUsers: 1, freeUsers: 3 });
        registrations.mockReset().mockResolvedValue([{ period: '2026-09-01', users: 4 }]);
    });

    describe.each(['/analytics/summary', '/analytics/registrations?period=day'])('%s', (url) => {
        it('requires a valid authentication cookie', async () => {
            await request(app.getHttpServer()).get(url).expect(401);
            await request(app.getHttpServer()).get(url).set('Cookie', 'access_token=invalid').expect(401);
            expect(summary).not.toHaveBeenCalled();
            expect(registrations).not.toHaveBeenCalled();
        });

        it('rejects USER and uses the current role from persistence', async () => {
            findById.mockResolvedValue({ ...user, role: UserRole.USER });
            await request(app.getHttpServer()).get(url).set('Cookie', cookie()).expect(403);
            expect(summary).not.toHaveBeenCalled();
            expect(registrations).not.toHaveBeenCalled();
        });

        it('rejects inactive accounts even when ADMIN', async () => {
            findById.mockResolvedValue({ ...user, status: UserStatus.INACTIVE });
            await request(app.getHttpServer()).get(url).set('Cookie', cookie()).expect(401);
        });
    });

    it('returns only the summary contract to ADMIN', async () => {
        await request(app.getHttpServer()).get('/analytics/summary')
            .set('Cookie', cookie()).expect(200, { totalUsers: 4, premiumUsers: 1, freeUsers: 3 });
    });

    it.each(['day', 'week', 'month'])('accepts period=%s', async (period) => {
        await request(app.getHttpServer()).get(`/analytics/registrations?period=${period}`)
            .set('Cookie', cookie()).expect(200, [{ period: '2026-09-01', users: 4 }]);
        expect(registrations).toHaveBeenCalledWith(period);
    });

    it.each(['', '?period=year', '?period=', '?period=DAY', '?period=day&period=week',
        '?period=day&role=ADMIN', '?period=day&userId=1'])('rejects invalid query %s', async (query) => {
        await request(app.getHttpServer()).get(`/analytics/registrations${query}`)
            .set('Cookie', cookie()).expect(400);
        expect(registrations).not.toHaveBeenCalled();
    });
});
