require('./environment.cjs');
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { JwtModule } = require('@nestjs/jwt');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { getLoggerToken } = require('nestjs-pino');
const { AuthService } = require('../../src/auth/auth.service.ts');
const { PasswordResetToken } = require('../../src/auth/entities/password-reset-token.entity.ts');

async function probe() {
  const metadata = Reflect.getMetadata('design:paramtypes', AuthService);
  console.log('[DI-METADATA tsx]', metadata ?? 'METADATA_NOT_FOUND');
  assert.equal(metadata, undefined);
  assert.deepEqual(Reflect.getMetadata('self:paramtypes', AuthService).map(({ index }) => index).sort(), [0, 6]);
  await assert.rejects(Test.createTestingModule({
    imports: [JwtModule.register({})],
    providers: [AuthService,
      { provide: getLoggerToken('AuthService'), useValue: {} },
      { provide: getRepositoryToken(PasswordResetToken), useValue: {} },
    ],
  }).compile(), (error) => {
    assert.equal(error.constructor.name, 'UndefinedDependencyException');
    assert.match(error.message, /index \[1\]/);
    console.log('[DI tsx] UndefinedDependencyException AuthService index [1]');
    return true;
  });
}
probe().catch((error) => { console.error(error); process.exitCode = 1; });
