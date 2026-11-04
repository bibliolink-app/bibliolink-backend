import 'reflect-metadata';
import { HttpStatus, ValidationPipe, type ArgumentsHost, type Type } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import type { PinoLogger } from 'nestjs-pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudflareTurnstileProvider } from '../captcha/providers/cloudflare-turnstile.provider';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { EmailService } from '../email/email.service';
import { BrevoEmailProvider } from '../email/providers/brevo-email.provider';
import { ReadingContentFetcherService } from '../reading/content/reading-content-fetcher.service';
import { EpubArchiveService } from '../reading/content/processors/epub/epub-archive.service';
import { PayPalProvider } from '../subscriptions/providers/paypal.provider';
import { CreateAdminDto } from '../users/dto/create-admin.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { SUPPORTED_LANGUAGES } from './i18n.constants';
import { createValidationException } from './localized-validation';
import type { MessageCode } from './messages';
import { translate, type MessageParams } from './translate';

const sendTransacEmail = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('@getbrevo/brevo', () => ({ BrevoClient: class { transactionalEmails = { sendTransacEmail }; } }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));
vi.mock('../config/envs', () => ({ envs: {
    email: { passwordResetTemplateId: 123, senderName: 'Test', senderEmail: 'sender@example.test' },
    brevo: { apiKey: 'fake-test-key' },
    captcha: { secretKey: 'fake-test-captcha-key' },
    reading: { contentRequestTimeoutMs: 1000, contentMaxBytes: 64 },
    payments: { baseUrl: 'https://payment.example.test', clientId: 'test-id', clientSecret: 'test-secret', webhookId: 'test-webhook', planId: 'test-plan' },
} }));

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as PinoLogger;
const fetchMock = vi.fn<typeof fetch>();

function present(exception: unknown, header?: string) {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = { switchToHttp: () => ({
        getRequest: () => ({ url: '/test', headers: header ? { 'accept-language': header } : {} }),
        getResponse: () => ({ status }),
    }) } as unknown as ArgumentsHost;
    new HttpExceptionFilter().catch(exception, host);
    return json.mock.calls[0][0];
}
async function rejection(operation: () => unknown): Promise<unknown> {
    try { await operation(); } catch (error: unknown) { return error; }
    throw new Error('Expected operation to reject');
}

describe('Localized domain boundaries without external services', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockReset().mockRejectedValue(new Error('Unexpected external request'));
        vi.stubGlobal('fetch', fetchMock);
        vi.mocked(lookup).mockReset();
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    const languages = [...SUPPORTED_LANGUAGES.map(language => ({ header: language as string | undefined, language })), { header: undefined, language: 'es' as const }, { header: 'de', language: 'es' as const }];
    describe.each(languages)('language=$header (resolved=$language)', ({ header, language }) => {
        async function check(operation: () => unknown, status: number, code: MessageCode, params?: MessageParams) {
            expect(present(await rejection(operation), header)).toEqual({
                statusCode: status, code, message: translate(code, language, params),
                error: HttpStatus[status], path: '/test', timestamp: expect.any(String),
            });
        }

        it.each(['network', 'status', 'shape'] as const)('keeps CAPTCHA availability errors safe: %s', async (failure) => {
            if (failure === 'status') fetchMock.mockResolvedValue(new Response('', { status: 503 }));
            if (failure === 'shape') fetchMock.mockResolvedValue(Response.json({ success: 'invalid' }));
            await check(() => new CloudflareTurnstileProvider(logger).verify('private-test-token'), 503, 'CAPTCHA_SERVICE_UNAVAILABLE');
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('keeps CAPTCHA acceptance and rejection independent of language', async () => {
            const provider = new CloudflareTurnstileProvider(logger);
            fetchMock.mockResolvedValueOnce(Response.json({ success: false })).mockResolvedValueOnce(Response.json({ success: true }));
            await expect(provider.verify('test-token')).resolves.toBe(false);
            await expect(provider.verify('test-token')).resolves.toBe(true);
        });

        it.each([
            ['not a URL', 'READING_CONTENT_URL_INVALID'],
            ['file:///book', 'READING_CONTENT_PROTOCOL_NOT_ALLOWED'],
            ['https://user:private@content.example.test/book', 'READING_CONTENT_CREDENTIALS_NOT_ALLOWED'],
            ['http://127.0.0.1/book', 'READING_CONTENT_DESTINATION_NOT_ALLOWED'],
            ['http://localhost/book', 'READING_CONTENT_DESTINATION_NOT_ALLOWED'],
        ] as const)('rejects disallowed document references without network: %s', async (url, code) => {
            await check(() => new ReadingContentFetcherService(logger).fetchContent(url), 502, code);
            expect(fetchMock).not.toHaveBeenCalled();
            expect(lookup).not.toHaveBeenCalled();
        });

        it('keeps upstream status interpolation and document size limits', async () => {
            const fetcher = new ReadingContentFetcherService(logger);
            // Dirección literal pública: no DNS; fetch siempre simulado.
            const url = 'https://8.8.8.8/book';
            fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
            await check(() => fetcher.fetchContent(url), 502, 'READING_CONTENT_HTTP_ERROR', { status: 404 });
            fetchMock.mockResolvedValueOnce(new Response('x', { headers: { 'content-length': '65' } }));
            await check(() => fetcher.fetchContent(url), 502, 'READING_CONTENT_TOO_LARGE');
            fetchMock.mockResolvedValueOnce(new Response('x'.repeat(65)));
            await check(() => fetcher.fetchContent(url), 502, 'READING_CONTENT_TOO_LARGE');
            fetchMock.mockResolvedValueOnce(new Response('x'.repeat(64)));
            await expect(fetcher.fetchContent(url)).resolves.toEqual(Buffer.from('x'.repeat(64)));
        });

        it('checks redirect destinations before a second fetch', async () => {
            fetchMock.mockResolvedValueOnce(new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
            await check(() => new ReadingContentFetcherService(logger).fetchContent('https://8.8.8.8/book'), 502, 'READING_CONTENT_DESTINATION_NOT_ALLOWED');
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('localizes invalid EPUB without exposing archive diagnostics', async () => {
            await check(() => new EpubArchiveService().readEntry(Buffer.from('invalid archive'), 'META-INF/container.xml'), 422, 'READING_EPUB_INVALID');
        });

        it('preserves payment authentication outages and provider-specific 404', async () => {
            await check(() => new PayPalProvider(logger).getAccessToken(), 503, 'SUBSCRIPTION_PAYMENT_SERVICE_UNAVAILABLE');
            fetchMock.mockResolvedValueOnce(Response.json({ access_token: 'fake-provider-token', expires_in: 3600, token_type: 'Bearer' }))
                .mockResolvedValueOnce(new Response('', { status: 404 }));
            await check(() => new PayPalProvider(logger).getSubscriptionIdentity('I-TEST'), 404, 'SUBSCRIPTION_PROVIDER_NOT_FOUND');
        });

        it('preserves webhook-specific 401 and refuses missing signature headers', async () => {
            await check(() => new PayPalProvider(logger).parseVerifiedWebhook({ rawBody: Buffer.from('{}'), headers: {} }), 401, 'SUBSCRIPTION_WEBHOOK_UNAUTHENTICATED');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('keeps webhook verification failure distinct from default authentication', async () => {
            fetchMock.mockResolvedValueOnce(Response.json({ access_token: 'fake-provider-token', expires_in: 3600, token_type: 'Bearer' }))
                .mockResolvedValueOnce(Response.json({ verification_status: 'FAILURE' }));
            const headers = { 'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://certificate.example.test', 'paypal-transmission-id': 'test-event', 'paypal-transmission-sig': 'test-signature', 'paypal-transmission-time': '2026-01-01T00:00:00Z' };
            await check(() => new PayPalProvider(logger).parseVerifiedWebhook({ rawBody: Buffer.from('{}'), headers }), 401, 'SUBSCRIPTION_WEBHOOK_UNAUTHENTICATED');
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toMatchObject({ transmission_sig: 'test-signature', webhook_id: 'test-webhook', webhook_event: {} });
        });

        it.each([
            [CreateAdminDto, { username: 1 }, 'username', 'VALIDATION_USERNAME_STRING'],
            [UpdateUserDto, { firstName: 1 }, 'firstName', 'VALIDATION_FIRST_NAME_STRING'],
            [UpdateUserDto, { email: 'invalid' }, 'email', 'VALIDATION_EMAIL_FORMAT'],
            [UpdateUserDto, { role: 'ADMIN' }, 'role', 'VALIDATION_PROPERTY_NOT_ALLOWED'],
        ] as const)('localizes users DTO %s: %s', async (dto, input, field, code) => {
            const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: createValidationException });
            const body = present(await rejection(() => pipe.transform(input, { type: 'body', metatype: dto as Type<object> })), header);
            expect(body.statusCode).toBe(400);
            expect(body.code).toBe('VALIDATION_FAILED');
            expect(body.details).toContainEqual({ field, code, message: translate(code, language, code === 'VALIDATION_PROPERTY_NOT_ALLOWED' ? { property: field } : undefined) });
        });
    });

    it.each(SUPPORTED_LANGUAGES)('sends translated subject and template parameters to the mocked Brevo client: %s', async (language) => {
        const service = new EmailService(logger, new BrevoEmailProvider(logger));
        const url = 'https://frontend.example.test/reset-password?token=private-test-token';
        await service.sendPasswordReset('reader@example.test', 'Reader', url, language);
        expect(sendTransacEmail).toHaveBeenCalledTimes(1);
        const options = sendTransacEmail.mock.calls[0][0];
        expect(options).toMatchObject({
            sender: { name: 'Test', email: 'sender@example.test' }, to: [{ email: 'reader@example.test' }],
            templateId: 123, subject: translate('EMAIL_PASSWORD_RESET_SUBJECT', language),
            params: { userName: 'Reader', resetUrl: url, language, currentYear: new Date().getFullYear() },
        });
        const codes = {
            preheader: 'EMAIL_PASSWORD_RESET_PREHEADER', title: 'EMAIL_PASSWORD_RESET_TITLE', greeting: 'EMAIL_PASSWORD_RESET_GREETING', intro: 'EMAIL_PASSWORD_RESET_INTRO',
            actionLabel: 'EMAIL_PASSWORD_RESET_ACTION', securityTitle: 'EMAIL_PASSWORD_RESET_SECURITY_TITLE', securityNotice: 'EMAIL_PASSWORD_RESET_SECURITY_NOTICE',
            ignoreNotice: 'EMAIL_PASSWORD_RESET_IGNORE_NOTICE', linkHelp: 'EMAIL_PASSWORD_RESET_LINK_HELP', brandTagline: 'EMAIL_BRAND_TAGLINE', brandClosing: 'EMAIL_BRAND_CLOSING',
            rightsReserved: 'EMAIL_RIGHTS_RESERVED', automatedNotice: 'EMAIL_AUTOMATED_NOTICE', securityFooter: 'EMAIL_SECURITY_FOOTER',
        } as const;
        for (const [key, code] of Object.entries(codes)) expect(options.params[key]).toBe(translate(code, language));
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
