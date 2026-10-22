import 'reflect-metadata';
import { expect, it } from 'vitest';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getLoggerToken } from 'nestjs-pino';
import { AuthService } from '../../src/auth/auth.service';
import { PasswordResetToken } from '../../src/auth/entities/password-reset-token.entity';
import { UsersService } from '../../src/users/users.service';
import { PasswordHasherService } from '../../src/common/security/password-hasher.service';
import { CaptchaService } from '../../src/captcha/captcha.service';
import { EmailService } from '../../src/email/email.service';
import { PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';

it('current Vitest preserves implicit types and explicit tokens and resolves the real AuthService', async () => {
  const metadata: unknown = Reflect.getMetadata('design:paramtypes', AuthService);
  console.log('[DI-METADATA vitest]', metadata ?? 'METADATA_NOT_FOUND');
  expect(metadata).toEqual([PinoLogger, JwtService, UsersService, PasswordHasherService, CaptchaService, EmailService, Repository]);
  const overrides: { index: number; param: unknown }[] = Reflect.getMetadata('self:paramtypes', AuthService);
  expect(overrides.map(({ index }) => index).sort()).toEqual([0, 6]);
  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })],
    providers: [AuthService,
      { provide: getLoggerToken(AuthService.name), useValue: {} },
      { provide: getRepositoryToken(PasswordResetToken), useValue: {} },
      ...[UsersService, PasswordHasherService, CaptchaService, EmailService].map((provide) => ({ provide, useValue: {} })),
    ],
  }).compile();
  try {
    expect(module.get(AuthService)).toBeInstanceOf(AuthService);
    expect(module.get(JwtService)).toBeInstanceOf(JwtService);
  } finally { await module.close(); }
});
