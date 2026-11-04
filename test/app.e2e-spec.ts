import 'reflect-metadata';
import { Controller, Get, HttpException, HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import type { PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { EntityManager, Repository } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { RegistrationsQueryDto } from '../src/analytics/dto/registrations-query.dto';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { BooksService } from '../src/books/books.service';
import { BookContentFormat } from '../src/catalogs/enums/book-content-format.enum';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { LocalizedThrottlerGuard } from '../src/common/guards/localized-throttler.guard';
import { FavoritesService } from '../src/favorites/favorites.service';
import { SUPPORTED_LANGUAGES } from '../src/i18n/i18n.constants';
import { createValidationException } from '../src/i18n/localized-validation';
import type { MessageCode } from '../src/i18n/messages';
import { translate, type MessageParams } from '../src/i18n/translate';
import { AdsService } from '../src/ads/ads.service';
import { PaymentTransactionsService } from '../src/payment_transactions/payment_transactions.service';
import { ReadingContentService } from '../src/reading/content/reading-content.service';
import { ReadingContentFetcherService } from '../src/reading/content/reading-content-fetcher.service';
import { EpubArchiveService } from '../src/reading/content/processors/epub/epub-archive.service';
import { EpubContentProcessorService } from '../src/reading/content/processors/epub/epub-content-processor.service';
import { HtmlContentProcessorService } from '../src/reading/content/processors/html/html-content-processor.service';
import { PdfContentProcessorService } from '../src/reading/content/processors/pdf/pdf-content-processor.service';
import { TextContentProcessorService } from '../src/reading/content/processors/text/text-content-processor.service';
import { RedeemRewardedAdDto } from '../src/reading/dto/redeem-rewarded-ad.dto';
import { ReadingAccess } from '../src/reading/entities/reading-access.entity';
import { ReadingController } from '../src/reading/reading.controller';
import { ReadingService } from '../src/reading/reading.service';
import { ConfirmSubscriptionDto } from '../src/subscriptions/dto/confirm-subscription.dto';
import { Subscription } from '../src/subscriptions/entities/subscription.entity';
import { SubscriptionStatus } from '../src/subscriptions/enums/subscription-status.enum';
import { SubscriptionEventStream } from '../src/subscriptions/events/subscription-event-stream.service';
import type { PaymentProvider } from '../src/subscriptions/interfaces/payment-provider.interface';
import { SubscriptionsController } from '../src/subscriptions/subscriptions.controller';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service';
import { createSubscriptionCheckoutReference } from '../src/subscriptions/utils/subscription-checkout-reference.util';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { UsersService } from '../src/users/users.service';

const config = vi.hoisted(() => ({
    frontendUrl: 'https://frontend.example.test',
    catalog: { requestTimeoutMs: 1000, contactEmail: 'test@example.test' },
    jwt: { access: { secret: 'isolated-e2e-access-secret-at-least-32-chars', expiresIn: '15m' } },
    payments: { checkoutReferenceSecret: 'isolated-e2e-checkout-secret-at-least-32-chars' },
    reading: { freePeriodMs: 600000 },
}));
vi.mock('../src/config/envs', () => ({ envs: config }));

// HTTP real con componentes de producción; persistencia y proveedores simulados.
// No importar AppModule: abriría la conexión MySQL configurada en el entorno.
@Controller('http-contract')
class HttpContractController {
    @Get('limited')
    @Throttle({ default: { limit: 1, ttl: 60000 } })
    limited() { return { accepted: true }; }

    @Get('specific')
    specific(): never { throw new HttpException('Specific public restriction', 429); }
}
const queryMock = () => ({ setLock: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), getOne: vi.fn() });

describe('Isolated backend HTTP contracts (e2e)', () => {
    let app: INestApplication<App>;
    const jwt = new JwtService();
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
    const findById = vi.fn<UsersService['findById']>();
    const getReadingSource = vi.fn<BooksService['getReadingSource']>();
    const findReadingState = vi.fn().mockResolvedValue(null);
    const fetchContent = vi.fn<ReadingContentFetcherService['fetchContent']>();
    const readingQuery = queryMock();
    const readingRepository = { findOne: vi.fn(), save: vi.fn(), createQueryBuilder: vi.fn(() => readingQuery), manager: { transaction: vi.fn() } };
    const subscriptionQuery = queryMock();
    const userQuery = queryMock();
    const repository = { findOne: vi.fn(), save: vi.fn(), create: vi.fn(), createQueryBuilder: vi.fn(() => subscriptionQuery), manager: { transaction: vi.fn() } };
    const manager = { getRepository: vi.fn((entity: unknown) => entity === User ? { createQueryBuilder: () => userQuery } : repository) };
    const readingManager = { getRepository: vi.fn(() => readingRepository) };
    const provider = {
        getSubscriptionIdentity: vi.fn<PaymentProvider['getSubscriptionIdentity']>(),
        parseVerifiedWebhook: vi.fn<PaymentProvider['parseVerifiedWebhook']>(),
        getConfirmedPayment: vi.fn<PaymentProvider['getConfirmedPayment']>(),
        getSubscriptionBillingInfo: vi.fn<PaymentProvider['getSubscriptionBillingInfo']>(),
    };
    const events = { publishActivation: vi.fn(), publishCancellation: vi.fn() };
    const payments = { recordSuccessfulPayment: vi.fn() };
    const ads = { issueRewardChallenge: vi.fn(), consumeRewardChallenge: vi.fn() };
    const analytics = { getRegistrationsByPeriod: vi.fn().mockResolvedValue([]) };
    const checkout = () => createSubscriptionCheckoutReference(11, 7, config.payments.checkoutReferenceSecret);
    const pending = () => ({ subscriptionId: 11, userId: 7, status: SubscriptionStatus.PENDING, externalSubscriptionReference: null });
    const cookie = () => `access_token=${jwt.sign({ sub: '7' }, { secret: config.jwt.access.secret, expiresIn: '15m' })}`;
    const setRole = (role: UserRole) => findById.mockResolvedValue({ userId: 7, role, status: UserStatus.ACTIVE } as Awaited<ReturnType<UsersService['findById']>>);
    const source = (contentFormat: BookContentFormat | null, contentReference: string | null = 'https://content.example.test/book') => getReadingSource.mockResolvedValue({ contentReference, contentFormat } as Awaited<ReturnType<BooksService['getReadingSource']>>);

    beforeAll(async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('External network forbidden in this suite')));
        // Vitest no emite design:paramtypes; reproducir metadata emitida por tsc.
        Reflect.defineMetadata('design:paramtypes', [ReadingService], ReadingController);
        Reflect.defineMetadata('design:paramtypes', [SubscriptionsService], SubscriptionsController);
        Reflect.defineMetadata('design:paramtypes', [AnalyticsService], AnalyticsController);
        Reflect.defineMetadata('design:paramtypes', [Object, RedeemRewardedAdDto], ReadingController.prototype, 'redeemRewardedAd');
        Reflect.defineMetadata('design:paramtypes', [Object, ConfirmSubscriptionDto], SubscriptionsController.prototype, 'confirmSubscription');
        Reflect.defineMetadata('design:paramtypes', [RegistrationsQueryDto], AnalyticsController.prototype, 'getRegistrationsByPeriod');
        const html = new HtmlContentProcessorService();
        const content = new ReadingContentService({ fetchContent } as ReadingContentFetcherService, new TextContentProcessorService(), html, new EpubContentProcessorService(new EpubArchiveService(), html), new PdfContentProcessorService());
        const subscriptions = new SubscriptionsService(repository as unknown as Repository<Subscription>, provider, payments as unknown as PaymentTransactionsService, events as unknown as SubscriptionEventStream, logger);
        const reading = new ReadingService(readingRepository as unknown as Repository<ReadingAccess>, { getReadingSource } as unknown as BooksService, { findReadingState } as unknown as FavoritesService, subscriptions, ads as unknown as AdsService, content);
        const module = await Test.createTestingModule({
            imports: [PassportModule.register({ defaultStrategy: 'jwt' }), ThrottlerModule.forRoot([{ ttl: 60000, limit: 10000 }])],
            controllers: [ReadingController, SubscriptionsController, AnalyticsController, HttpContractController],
            providers: [
                { provide: ReadingService, useValue: reading },
                { provide: SubscriptionsService, useValue: subscriptions },
                { provide: AnalyticsService, useValue: analytics },
                { provide: JwtStrategy, useFactory: () => new JwtStrategy({ findById } as unknown as UsersService) },
                { provide: APP_GUARD, useClass: LocalizedThrottlerGuard },
            ],
        }).overrideGuard(RolesGuard).useValue(new RolesGuard(new Reflector())).compile();
        app = module.createNestApplication({ rawBody: true });
        app.use(cookieParser());
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: createValidationException }));
        app.useGlobalFilters(new HttpExceptionFilter());
        await app.init();
    });
    afterAll(async () => { await app?.close(); vi.unstubAllGlobals(); });
    beforeEach(() => {
        vi.clearAllMocks();
        setRole(UserRole.USER);
        source(BookContentFormat.TEXT);
        fetchContent.mockResolvedValue(Buffer.from('Original book <text>'));
        readingRepository.findOne.mockResolvedValue({ userId: 7, expiresAt: new Date(Date.now() + 600000) });
        readingQuery.getOne.mockResolvedValue({ userId: 7, expiresAt: new Date(0) });
        readingRepository.manager.transaction.mockImplementation((operation: (value: EntityManager) => unknown) => operation(readingManager as unknown as EntityManager));
        repository.findOne.mockResolvedValue(null);
        repository.save.mockImplementation(async (value: unknown) => value);
        repository.manager.transaction.mockImplementation((operation: (value: EntityManager) => unknown) => operation(manager as unknown as EntityManager));
        subscriptionQuery.getOne.mockResolvedValue(pending());
        userQuery.getOne.mockResolvedValue({ userId: 7, status: UserStatus.ACTIVE });
        provider.getSubscriptionIdentity.mockResolvedValue({ checkoutReference: checkout(), status: 'APPROVED' });
        ads.consumeRewardChallenge.mockResolvedValue(false);
    });

    const languages = [...SUPPORTED_LANGUAGES.map(language => ({ header: language as string | undefined, language })), { header: undefined, language: 'es' as const }, { header: 'de', language: 'es' as const }];
    describe.each(languages)('language=$header (resolved=$language)', ({ header, language }) => {
        function call(method: 'get' | 'post', path: string, authenticated = true) {
            const result = request(app.getHttpServer())[method](path);
            if (header) result.set('Accept-Language', header);
            if (authenticated) result.set('Cookie', cookie());
            return result;
        }
        function error(response: request.Response, status: number, code: MessageCode, path: string, params?: MessageParams) {
            expect(response.status).toBe(status);
            expect(response.body).toEqual({ statusCode: status, code, message: translate(code, language, params), error: HttpStatus[status], path, timestamp: expect.any(String) });
            expect(response.headers['set-cookie']).toBeUndefined();
        }
        function validation(response: request.Response, field: string, code: MessageCode, params?: MessageParams) {
            expect(response.status).toBe(400);
            expect(response.body.code).toBe('VALIDATION_FAILED');
            expect(response.body.details).toContainEqual({ field, code, message: translate(code, language, params) });
            expect(response.body.message).toContain(translate(code, language, params));
        }
        it('localizes Passport 401 and role 403 without calling the domain', async () => {
            const path = '/reading/books/1/pages/1';
            error(await call('get', path, false), 401, 'AUTH_UNAUTHORIZED', path);
            error(await call('get', path, false).set('Cookie', 'access_token=invalid'), 401, 'AUTH_UNAUTHORIZED', path);
            setRole(UserRole.ADMIN);
            error(await call('get', path), 403, 'AUTH_FORBIDDEN', path);
            expect(getReadingSource).not.toHaveBeenCalled();
        });
        it('preserves missing/expired reading periods and blocks content fetching', async () => {
            const path = '/reading/books/1/pages/1';
            readingRepository.findOne.mockResolvedValue(null);
            error(await call('get', path), 403, 'READING_PERIOD_REQUIRED', path);
            readingRepository.findOne.mockResolvedValue({ expiresAt: new Date(0) });
            error(await call('get', path), 403, 'READING_PERIOD_EXPIRED', path);
            expect(fetchContent).not.toHaveBeenCalled();
        });
        it('preserves Premium restrictions and reward consumption rules', async () => {
            const path = '/reading/reward-challenge';
            repository.findOne.mockResolvedValue({ status: SubscriptionStatus.ACTIVE });
            error(await call('post', path), 409, 'READING_PREMIUM_AD_NOT_REQUIRED', path);
            error(await call('post', '/reading/reward').send({ token: 'private-reward' }), 409, 'READING_PREMIUM_REWARD_NOT_REQUIRED', '/reading/reward');
            expect(readingRepository.manager.transaction).not.toHaveBeenCalled();
            repository.findOne.mockResolvedValue(null);
            error(await call('post', path), 409, 'READING_PERIOD_ACTIVE', path);
            readingRepository.findOne.mockResolvedValue(null);
            error(await call('post', path), 409, 'READING_PERIOD_REQUIRED', path);
            error(await call('post', '/reading/reward').send({ token: 'private-reward' }), 409, 'READING_REWARD_INVALID', '/reading/reward');
            expect(readingQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
            expect(ads.consumeRewardChallenge).toHaveBeenCalledWith(7, 'private-reward', readingManager);
            expect(readingRepository.save).not.toHaveBeenCalled();
            expect(ads.issueRewardChallenge).not.toHaveBeenCalled();
        });
        it('localizes numeric pipes and reward DTO before domain operations', async () => {
            error(await call('get', '/reading/books/no/pages/1'), 400, 'VALIDATION_BOOK_ID_INTEGER', '/reading/books/no/pages/1');
            error(await call('get', '/reading/books/1/pages/no'), 400, 'VALIDATION_PAGE_INTEGER', '/reading/books/1/pages/no');
            validation(await call('post', '/reading/reward').send({ token: 42 }), 'token', 'VALIDATION_REWARD_TOKEN_STRING');
            validation(await call('post', '/reading/reward').send({ token: '' }), 'token', 'VALIDATION_REWARD_TOKEN_REQUIRED');
            expect(getReadingSource).not.toHaveBeenCalled();
            expect(ads.consumeRewardChallenge).not.toHaveBeenCalled();
        });
        it('keeps document content unchanged and localizes processor errors', async () => {
            const path = '/reading/books/1/pages/';
            await call('get', path + '1').expect(200, { pageNumber: 1, contentType: 'HTML', content: '<p>Original book &lt;text&gt;</p>', hasNextPage: false });
            error(await call('get', path + '0'), 422, 'VALIDATION_PAGE_MIN', path + '0', { min: 1 });
            error(await call('get', path + '2'), 422, 'READING_PAGE_NOT_FOUND', path + '2');
            fetchContent.mockResolvedValue(Buffer.alloc(0));
            error(await call('get', path + '1'), 422, 'READING_TEXT_CONTENT_EMPTY', path + '1');
        });
        it.each([BookContentFormat.HTML, BookContentFormat.EPUB, BookContentFormat.PDF])('keeps invalid page rejection for %s', async (format) => {
            source(format);
            error(await call('get', '/reading/books/1/pages/0'), 422, 'VALIDATION_PAGE_MIN', '/reading/books/1/pages/0', { min: 1 });
        });
        it('rejects unavailable and unsupported sources before fetching', async () => {
            const path = '/reading/books/1/access';
            source(null, null);
            error(await call('post', path), 422, 'READING_CONTENT_UNAVAILABLE', path);
            source(BookContentFormat.UNSUPPORTED);
            error(await call('post', path), 422, 'READING_CONTENT_FORMAT_UNSUPPORTED', path);
            expect(fetchContent).not.toHaveBeenCalled();
        });
        it('localizes subscription DTO checks before payment operations', async () => {
            const path = '/subscriptions/confirm';
            validation(await call('post', path).send({ subscriptionId: '11', externalSubscriptionReference: 'I-TEST' }), 'subscriptionId', 'VALIDATION_SUBSCRIPTION_ID_INTEGER');
            validation(await call('post', path).send({ subscriptionId: 0, externalSubscriptionReference: 'I-TEST' }), 'subscriptionId', 'VALIDATION_SUBSCRIPTION_ID_MIN', { min: 1 });
            for (const [value, code, params] of [[7, 'VALIDATION_REFERENCE_STRING', undefined], ['', 'VALIDATION_REFERENCE_REQUIRED', undefined], ['x'.repeat(256), 'VALIDATION_REFERENCE_MAX_LENGTH', { max: 255 }]] as const) {
                validation(await call('post', path).send({ subscriptionId: 11, externalSubscriptionReference: value }), 'externalSubscriptionReference', code, params);
            }
            expect(provider.getSubscriptionIdentity).not.toHaveBeenCalled();
            expect(repository.manager.transaction).not.toHaveBeenCalled();
        });
        it('keeps reservation existence, approval, ownership and signature checks', async () => {
            const path = '/subscriptions/confirm';
            const confirm = () => call('post', path).send({ subscriptionId: 11, externalSubscriptionReference: 'I-TEST' });
            error(await confirm(), 404, 'SUBSCRIPTION_RESERVATION_NOT_FOUND', path);
            expect(provider.getSubscriptionIdentity).not.toHaveBeenCalled();
            repository.findOne.mockResolvedValue(pending());
            provider.getSubscriptionIdentity.mockResolvedValue({ checkoutReference: createSubscriptionCheckoutReference(12, 7, config.payments.checkoutReferenceSecret), status: 'APPROVED' });
            error(await confirm(), 403, 'SUBSCRIPTION_RESERVATION_MISMATCH', path);
            provider.getSubscriptionIdentity.mockResolvedValue({ checkoutReference: checkout(), status: 'APPROVAL_PENDING' });
            error(await confirm(), 409, 'SUBSCRIPTION_PAYPAL_NOT_APPROVED', path);
            provider.getSubscriptionIdentity.mockResolvedValue({ checkoutReference: checkout(), status: 'APPROVED' });
            subscriptionQuery.getOne.mockResolvedValue({ ...pending(), userId: 8 });
            error(await confirm(), 403, 'SUBSCRIPTION_OWNERSHIP_MISMATCH', path);
            subscriptionQuery.getOne.mockResolvedValue(pending());
            provider.getSubscriptionIdentity.mockResolvedValue({ checkoutReference: createSubscriptionCheckoutReference(11, 7, 'wrong-test-signing-key'), status: 'APPROVED' });
            error(await confirm(), 403, 'SUBSCRIPTION_CHECKOUT_REFERENCE_INVALID', path);
            expect(repository.save).not.toHaveBeenCalled();
            expect(payments.recordSuccessfulPayment).not.toHaveBeenCalled();
            expect(events.publishActivation).not.toHaveBeenCalled();
        });
        it('keeps successful linking 204, PENDING status and idempotency', async () => {
            const reservation = pending();
            repository.findOne.mockResolvedValue(reservation);
            subscriptionQuery.getOne.mockResolvedValue(reservation);
            for (let i = 0; i < 2; i++) {
                const response = await call('post', '/subscriptions/confirm').send({ subscriptionId: 11, externalSubscriptionReference: 'I-TEST' }).expect(204);
                expect(response.text).toBe('');
                expect(response.headers['set-cookie']).toBeUndefined();
            }
            expect(reservation).toEqual({ ...pending(), externalSubscriptionReference: 'I-TEST' });
            expect(repository.save).toHaveBeenCalledTimes(1);
            expect(subscriptionQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
            expect(payments.recordSuccessfulPayment).not.toHaveBeenCalled();
            expect(events.publishActivation).not.toHaveBeenCalled();
        });
        it('keeps account and existing-subscription restrictions', async () => {
            userQuery.getOne.mockResolvedValue(null);
            error(await call('post', '/subscriptions'), 404, 'USER_NOT_FOUND', '/subscriptions');
            userQuery.getOne.mockResolvedValue({ userId: 7, status: UserStatus.INACTIVE });
            error(await call('post', '/subscriptions'), 403, 'SUBSCRIPTION_ACCOUNT_INACTIVE', '/subscriptions');
            userQuery.getOne.mockResolvedValue({ userId: 7, status: UserStatus.ACTIVE });
            repository.findOne.mockResolvedValue(pending());
            error(await call('post', '/subscriptions'), 409, 'SUBSCRIPTION_ALREADY_EXISTS', '/subscriptions');
            expect(repository.save).not.toHaveBeenCalled();
        });
        it('passes exact rawBody and signature headers to verification and keeps 204', async () => {
            const path = '/subscriptions/webhooks/paypal';
            error(await call('post', path, false), 400, 'SUBSCRIPTION_WEBHOOK_BODY_REQUIRED', path);
            expect(provider.parseVerifiedWebhook).not.toHaveBeenCalled();
            provider.parseVerifiedWebhook.mockResolvedValue({ type: 'SUBSCRIPTION_CANCELED', externalSubscriptionReference: 'I-TEST' });
            repository.findOne.mockResolvedValue({ ...pending(), externalSubscriptionReference: 'I-TEST' });
            subscriptionQuery.getOne.mockResolvedValue({ ...pending(), status: SubscriptionStatus.CANCELED });
            const rawBody = '{ "event_type" : "BILLING.SUBSCRIPTION.CANCELLED" }';
            const response = await call('post', path, false).set('Content-Type', 'application/json').set('paypal-transmission-sig', 'test-signature').send(rawBody).expect(204);
            expect(response.text).toBe('');
            expect(provider.parseVerifiedWebhook).toHaveBeenCalledWith({ rawBody: Buffer.from(rawBody), headers: expect.objectContaining({ 'paypal-transmission-sig': 'test-signature' }) });
            expect(repository.save).not.toHaveBeenCalled();
            expect(events.publishCancellation).not.toHaveBeenCalled();
        });
        it('keeps payment amount and currency rules before any transaction', async () => {
            const path = '/subscriptions/webhooks/paypal';
            const paidAt = new Date('2026-01-01T00:00:00Z');
            provider.parseVerifiedWebhook.mockResolvedValue({ type: 'PAYMENT_SUCCEEDED', externalSubscriptionReference: 'I-TEST', externalPaymentReference: 'PAY-TEST', paidAt });
            repository.findOne.mockResolvedValue({ ...pending(), externalSubscriptionReference: 'I-TEST' });
            provider.getSubscriptionBillingInfo.mockResolvedValue({ lastPaymentAt: paidAt, nextBillingTime: new Date('2026-02-01T00:00:00Z') });
            for (const [amount, currencyCode, code] of [
                ['invalid', 'USD', 'SUBSCRIPTION_PAYMENT_AMOUNT_INVALID'],
                ['4.99', 'USD', 'SUBSCRIPTION_PAYMENT_PLAN_AMOUNT_MISMATCH'],
                ['5.01', 'USD', 'SUBSCRIPTION_PAYMENT_PLAN_AMOUNT_MISMATCH'],
                ['5.00', 'CRC', 'SUBSCRIPTION_PAYMENT_PLAN_AMOUNT_MISMATCH'],
            ] as const) {
                provider.getConfirmedPayment.mockResolvedValue({ externalReference: 'PAY-TEST', amount, currencyCode, paidAt });
                error(await call('post', path, false).send({ event_type: 'PAYMENT.SALE.COMPLETED' }), 422, code, path);
            }
            expect(repository.manager.transaction).not.toHaveBeenCalled();
            expect(payments.recordSuccessfulPayment).not.toHaveBeenCalled();
            expect(events.publishActivation).not.toHaveBeenCalled();
        });
        it('validates analytics periods without translating enums or results', async () => {
            setRole(UserRole.ADMIN);
            validation(await call('get', '/analytics/registrations?period=year'), 'period', 'VALIDATION_REGISTRATION_PERIOD', { values: 'day, week, month' });
            expect(analytics.getRegistrationsByPeriod).not.toHaveBeenCalled();
            for (const period of ['day', 'week', 'month']) {
                await call('get', `/analytics/registrations?period=${period}`).expect(200, []);
                expect(analytics.getRegistrationsByPeriod).toHaveBeenLastCalledWith(period);
            }
        });
    });
    it('localizes throttling with Retry-After and the original request count', async () => {
        await request(app.getHttpServer()).get('/http-contract/limited').expect(200, { accepted: true });
        for (const { header, language } of languages) {
            const call = request(app.getHttpServer()).get('/http-contract/limited');
            if (header) call.set('Accept-Language', header);
            const response = await call.expect(429);
            expect(response.body).toEqual({ statusCode: 429, code: 'REQUEST_RATE_LIMITED', message: translate('REQUEST_RATE_LIMITED', language), error: 'TOO_MANY_REQUESTS', path: '/http-contract/limited', timestamp: expect.any(String) });
            expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
        }
    });
    it.each(SUPPORTED_LANGUAGES)('preserves explicit errors and automatic 404 in %s', async (language) => {
        const explicit = await request(app.getHttpServer()).get('/http-contract/specific').set('Accept-Language', language).expect(429);
        expect(explicit.body.code).toBeNull();
        expect(explicit.body.message).toBe('Specific public restriction');
        const missing = await request(app.getHttpServer()).get('/nonexistent').set('Accept-Language', language).expect(404);
        expect(missing.body.code).toBeNull();
        expect(missing.body.message).toBe('Cannot GET /nonexistent');
    });
});
