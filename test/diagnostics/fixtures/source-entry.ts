import 'reflect-metadata';
import { AuthService } from '../../../src/auth/auth.service';
import { PasswordResetToken } from '../../../src/auth/entities/password-reset-token.entity';
import { UsersService } from '../../../src/users/users.service';
import { PasswordHasherService } from '../../../src/common/security/password-hasher.service';
import { CaptchaService } from '../../../src/captcha/captcha.service';
import { EmailService } from '../../../src/email/email.service';
const { serve } = require('../runtime-fixture.cjs');
serve(AuthService, PasswordResetToken, [UsersService, PasswordHasherService, CaptchaService, EmailService]);
