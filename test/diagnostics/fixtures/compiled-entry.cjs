require('reflect-metadata');
const { AuthService } = require('../../../dist/auth/auth.service.js');
const { PasswordResetToken } = require('../../../dist/auth/entities/password-reset-token.entity.js');
const { UsersService } = require('../../../dist/users/users.service.js');
const { PasswordHasherService } = require('../../../dist/common/security/password-hasher.service.js');
const { CaptchaService } = require('../../../dist/captcha/captcha.service.js');
const { EmailService } = require('../../../dist/email/email.service.js');
require('../runtime-fixture.cjs').serve(AuthService, PasswordResetToken, [UsersService, PasswordHasherService, CaptchaService, EmailService]);
