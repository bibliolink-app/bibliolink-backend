import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordHasherService } from '../common/security/password-hasher.service';
import { PaymentTransactionsService } from '../payment_transactions/payment_transactions.service';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionStatus } from '../subscriptions/enums/subscription-status.enum';
import { SubscriptionEventStream } from '../subscriptions/events/subscription-event-stream.service';
import type { PaymentProvider } from '../subscriptions/interfaces/payment-provider.interface';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';
import { RegistrationPeriod } from '../users/enums/registration-period.enum';
import { UsersService } from '../users/users.service';
import { AnalyticsService } from './analytics.service';

vi.mock('../config/envs', () => ({ envs: {} }));

// Opt-in: ANALYTICS_MYSQL_TESTS=1, usando DATABASE_* del entorno/.env.
// Una sola conexión mantiene tablas TEMPORARY con nombres únicos por ejecución.
// synchronize y migrationsRun quedan desactivados; no se escriben datos persistentes.
describe.skipIf(process.env.ANALYTICS_MYSQL_TESTS !== '1')('Analytics MySQL aggregates', () => {
    let source: DataSource;
    let users: UsersService;
    let subscriptions: SubscriptionsService;
    let analytics: AnalyticsService;
    const prefix = `analytics_test_${randomUUID().replaceAll('-', '')}_`;
    const usersTable = `\`${prefix}users\``;
    const subscriptionsTable = `\`${prefix}subscriptions\``;
    const provider: PaymentProvider = {
        getSubscriptionIdentity: vi.fn<PaymentProvider['getSubscriptionIdentity']>(),
        getSubscriptionBillingInfo: vi.fn<PaymentProvider['getSubscriptionBillingInfo']>(),
        getConfirmedPayment: vi.fn<PaymentProvider['getConfirmedPayment']>(),
        parseVerifiedWebhook: vi.fn<PaymentProvider['parseVerifiedWebhook']>(),
    };

    beforeAll(async () => {
        source = new DataSource({
            type: 'mysql', host: process.env.DATABASE_HOST,
            port: Number(process.env.DATABASE_PORT ?? 3306),
            username: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME, timezone: 'Z', dateStrings: false,
            entities: [User, Subscription], synchronize: false, migrationsRun: false,
            entityPrefix: prefix,
            extra: { connectionLimit: 1 },
        });
        await source.initialize();
        await source.query(`CREATE TEMPORARY TABLE ${usersTable} (
            user_id INT UNSIGNED PRIMARY KEY, role VARCHAR(10) NOT NULL,
            status VARCHAR(10) NOT NULL, created_at DATETIME(3) NOT NULL
        ) ENGINE=InnoDB`);
        await source.query(`CREATE TEMPORARY TABLE ${subscriptionsTable} (
            subscription_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL, status VARCHAR(20) NOT NULL,
            current_period_end DATETIME(3) NULL
        ) ENGINE=InnoDB`);
        const logger = new PinoLogger({ pinoHttp: { level: 'silent' } });
        users = new UsersService(logger, source.getRepository(User), new PasswordHasherService());
        subscriptions = new SubscriptionsService(source.getRepository(Subscription), provider,
            new PaymentTransactionsService(logger), new SubscriptionEventStream(), logger);
        analytics = new AnalyticsService(users, subscriptions, source);
    });

    afterAll(async () => { if (source?.isInitialized) await source.destroy(); });
    beforeEach(async () => {
        await source.query(`DELETE FROM ${subscriptionsTable}`);
        await source.query(`DELETE FROM ${usersTable}`);
        // Inserción desordenada, límites de año/mes y domingo/lunes, USER inactivo incluido.
        const rows: [number, UserRole, UserStatus, string][] = [
            [1, UserRole.USER, UserStatus.ACTIVE, '2026-01-05 00:00:00.000'],
            [2, UserRole.USER, UserStatus.ACTIVE, '2025-12-31 23:59:59.999'],
            [3, UserRole.USER, UserStatus.INACTIVE, '2026-01-01 00:00:00.000'],
            [4, UserRole.USER, UserStatus.ACTIVE, '2026-01-04 23:59:59.999'],
            [5, UserRole.USER, UserStatus.ACTIVE, '2026-02-01 12:00:00.000'],
            [6, UserRole.USER, UserStatus.ACTIVE, '2026-02-01 23:59:59.999'],
            [7, UserRole.USER, UserStatus.ACTIVE, '2026-02-02 00:00:00.000'],
            [8, UserRole.ADMIN, UserStatus.ACTIVE, '2026-02-01 12:00:00.000'],
            [9, UserRole.ADMIN, UserStatus.ACTIVE, '2024-01-01 00:00:00.000'],
        ];
        for (const row of rows) {
            await source.query(`INSERT INTO ${usersTable} (user_id, role, status, created_at) VALUES (?, ?, ?, ?)`, row);
        }
        const states: [number, SubscriptionStatus][] = [
            [1, SubscriptionStatus.ACTIVE], [1, SubscriptionStatus.ACTIVE],
            [2, SubscriptionStatus.CANCELED], [3, SubscriptionStatus.ACTIVE],
            [4, SubscriptionStatus.PENDING], [5, SubscriptionStatus.PAST_DUE],
            [6, SubscriptionStatus.EXPIRED], [8, SubscriptionStatus.ACTIVE],
            [9, SubscriptionStatus.ACTIVE],
        ];
        for (const row of states) {
            await source.query(`INSERT INTO ${subscriptionsTable} (user_id, status, current_period_end) VALUES (?, ?, ?)`,
                [...row, row[1] === SubscriptionStatus.ACTIVE ? '2020-01-01' : '2099-01-01']);
        }
    });

    it('counts only USER, including inactive users', async () => {
        expect(await users.countRegisteredUsers()).toBe(7);
    });

    it('counts distinct ACTIVE USER subscribers, excluding ADMIN and every other status', async () => {
        expect(await subscriptions.countActiveSubscribers()).toBe(2);
    });

    it('excludes ADMIN from all summary counts and derives FREE', async () => {
        expect(await analytics.getSummary()).toEqual({ totalUsers: 7, premiumUsers: 2, freeUsers: 5 });
    });

    it('returns zero counts and empty registrations for an ADMIN-only population', async () => {
        await source.query(`DELETE FROM ${subscriptionsTable} WHERE user_id < 8`);
        await source.query(`DELETE FROM ${usersTable} WHERE role = ?`, [UserRole.USER]);
        expect(await analytics.getSummary()).toEqual({ totalUsers: 0, premiumUsers: 0, freeUsers: 0 });
        for (const period of Object.values(RegistrationPeriod)) {
            expect(await analytics.getRegistrationsByPeriod(period)).toEqual([]);
        }
    });

    it('groups USER registrations by stored calendar day in chronological order', async () => {
        expect(await analytics.getRegistrationsByPeriod(RegistrationPeriod.DAY)).toEqual([
            { period: '2025-12-31', users: 1 }, { period: '2026-01-01', users: 1 },
            { period: '2026-01-04', users: 1 }, { period: '2026-01-05', users: 1 },
            { period: '2026-02-01', users: 2 }, { period: '2026-02-02', users: 1 },
        ]);
    });

    it('groups weeks starting Monday across year boundaries, excluding ADMIN', async () => {
        expect(await analytics.getRegistrationsByPeriod(RegistrationPeriod.WEEK)).toEqual([
            { period: '2025-12-29', users: 3 }, { period: '2026-01-05', users: 1 },
            { period: '2026-01-26', users: 2 }, { period: '2026-02-02', users: 1 },
        ]);
    });

    it('groups months without mixing years, excluding ADMIN', async () => {
        expect(await analytics.getRegistrationsByPeriod(RegistrationPeriod.MONTH)).toEqual([
            { period: '2025-12-01', users: 1 }, { period: '2026-01-01', users: 3 },
            { period: '2026-02-01', users: 3 },
        ]);
    });
});
