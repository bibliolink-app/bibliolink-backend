require('./environment.cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Test } = require('@nestjs/testing');
const { Module, Global, ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { PassportModule } = require('@nestjs/passport');
const { DataSource, Repository } = require('typeorm');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { LoggerModule, PinoLogger, getLoggerToken } = require('nestjs-pino');
const request = require('supertest');
const { AuthService } = require('../../dist/auth/auth.service.js');
const { AuthModule } = require('../../dist/auth/auth.module.js');
const { UsersService } = require('../../dist/users/users.service.js');
const { PasswordHasherService } = require('../../dist/common/security/password-hasher.service.js');
const { CaptchaService } = require('../../dist/captcha/captcha.service.js');
const { EmailService } = require('../../dist/email/email.service.js');
const { PasswordResetToken } = require('../../dist/auth/entities/password-reset-token.entity.js');
const { CategoriesModule } = require('../../dist/categories/categories.module.js');
const { Category } = require('../../dist/categories/entities/category.entity.js');
const { HttpExceptionFilter } = require('../../dist/common/filters/http-exception.filter.js');
const { AppModule } = require('../../dist/app.module.js');
const { SubscriptionsController } = require('../../dist/subscriptions/subscriptions.controller.js');
const { SubscriptionsService } = require('../../dist/subscriptions/subscriptions.service.js');

function persistenceDouble() {
  let failure = false;
  const rows = [{ categoryId: '1', code: 'fiction', name: 'Ficción', bookCount: '2' }];
  const query = {};
  for (const method of ['leftJoin', 'select', 'addSelect', 'groupBy', 'orderBy', 'addOrderBy']) {
    query[method] = () => query;
  }
  query.getRawMany = async () => {
    if (failure) throw new Error('diagnostic SQL detail must not reach HTTP');
    return rows;
  };
  const categories = { createQueryBuilder: () => query, findOne: async () => null };
  const repositories = new Map([[Category, categories]]);
  const source = {
    options: { type: 'mysql' }, entityMetadatas: [], manager: {}, isInitialized: false,
    getRepository(entity) {
      if (!repositories.has(entity)) repositories.set(entity, {});
      return repositories.get(entity);
    },
  };
  return { source, fail: () => { failure = true; } };
}

function infrastructure(source) {
  class DiagnosticPersistenceModule {}
  Global()(DiagnosticPersistenceModule);
  Module({ providers: [{ provide: DataSource, useValue: source }], exports: [DataSource] })(DiagnosticPersistenceModule);
  return [DiagnosticPersistenceModule, LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })];
}

test('nest build emits the seven real constructor types and explicit override tokens', () => {
  const artifact = readFileSync(resolve(__dirname, '../../dist/auth/auth.service.js'), 'utf8');
  assert.match(artifact, /__metadata\("design:paramtypes"/);
  const dependencies = Reflect.getMetadata('design:paramtypes', AuthService);
  assert.deepEqual(dependencies, [PinoLogger, JwtService, UsersService, PasswordHasherService, CaptchaService, EmailService, Repository]);
  const overrides = Reflect.getMetadata('self:paramtypes', AuthService);
  assert.deepEqual(overrides.map(({ index }) => index).sort(), [0, 6]);
  assert.equal(overrides.find(({ index }) => index === 0).param, getLoggerToken('AuthService'));
  assert.equal(overrides.find(({ index }) => index === 6).param, getRepositoryToken(PasswordResetToken));
  console.log('[DI-METADATA compiled]', dependencies.map((item) => item.name).join(', '));
});

test('real AuthModule resolves JwtService and every AuthService dependency', { timeout: 15000 }, async () => {
  const { source } = persistenceDouble();
  const module = await Test.createTestingModule({ imports: [...infrastructure(source), AuthModule] }).compile();
  try {
    await module.init();
    const auth = module.get(AuthService);
    assert.ok(auth instanceof AuthService);
    assert.equal(auth.jwtService, module.get(JwtService));
    for (const field of ['logger', 'usersService', 'passwordHasher', 'captchaService', 'emailService', 'passwordResetTokensRepository']) {
      assert.ok(auth[field], `Missing injected dependency: ${field}`);
    }
    const token = await module.get(JwtService).signAsync({ sub: '7' });
    assert.equal((await module.get(JwtService).verifyAsync(token)).sub, '7');
  } finally { await module.close(); }
});

test('CategoriesModule serves unauthenticated HTTP using real controller/service and fake repository', { timeout: 15000 }, async () => {
  const db = persistenceDouble();
  const module = await Test.createTestingModule({ imports: [...infrastructure(db.source), CategoriesModule] }).compile();
  const app = module.createNestApplication({ logger: false, rawBody: true });
  try {
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await request(app.getHttpServer()).get('/categories').timeout(3000).expect(200)
      .expect([{ categoryId: 1, code: 'fiction', name: 'Ficción', bookCount: 2 }]);
    await request(app.getHttpServer()).get('/categories/invalid-code/books').timeout(3000).expect(400);
    db.fail();
    const response = await request(app.getHttpServer()).get('/categories').timeout(3000).expect(500);
    assert.equal(response.body.message, 'Ha ocurrido un error inesperado.');
    assert.equal(response.body.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(response.body), /SQL detail|stack/);
  } finally { await app.close(); }
});

test('real AppModule initializes and exposes public categories with the DataSource boundary replaced', { timeout: 15000 }, async () => {
  const { source } = persistenceDouble();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource).useValue(source)
    .overrideProvider('pino-params').useValue({ pinoHttp: { level: 'silent' } })
    .compile();
  const app = module.createNestApplication({ logger: false, rawBody: true });
  try {
    await app.init();
    assert.ok(module.get(AuthService).jwtService instanceof JwtService);
    await request(app.getHttpServer()).get('/categories').timeout(3000).expect(200);
    await request(app.getHttpServer()).get('/').timeout(3000).expect(404);
  } finally { await app.close(); }
});

test('losing only AuthService implicit metadata prevents global startup despite registered JwtService', { timeout: 15000 }, async () => {
  const metadata = Reflect.getMetadata('design:paramtypes', AuthService);
  Reflect.deleteMetadata('design:paramtypes', AuthService);
  try {
    const { source } = persistenceDouble();
    await assert.rejects(
      Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DataSource).useValue(source).compile(),
      (error) => {
        assert.equal(error.constructor.name, 'UndefinedDependencyException');
        assert.match(error.message, /AuthService/);
        assert.match(error.message, /index \[1\]/);
        return true;
      },
    );
  } finally { Reflect.defineMetadata('design:paramtypes', metadata, AuthService); }
});

test('PayPal HTTP controller receives the exact raw JSON bytes; missing rawBody is rejected', { timeout: 15000 }, async () => {
  const raw = '{ "id" : "diagnostic-event", "resource" : { "value" : 1 } }';
  let received;
  const module = await Test.createTestingModule({
    imports: [PassportModule.register({ session: false })],
    controllers: [SubscriptionsController],
    providers: [{ provide: SubscriptionsService, useValue: {
      processPaymentWebhook: async (input) => { received = input; },
    } }],
  }).compile();
  const app = module.createNestApplication({ logger: false, rawBody: true });
  try {
    await app.init();
    await request(app.getHttpServer()).post('/subscriptions/webhooks/paypal')
      .set('Content-Type', 'application/json').send(raw).timeout(3000).expect(204);
    assert.ok(Buffer.isBuffer(received.rawBody));
    assert.deepEqual(received.rawBody, Buffer.from(raw));
    received = undefined;
    await request(app.getHttpServer()).post('/subscriptions/webhooks/paypal')
      .timeout(3000).expect(400);
    assert.equal(received, undefined);
  } finally { await app.close(); }
});
