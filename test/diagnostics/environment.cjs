// Loaded before application imports. Never read the developer's .env.
const path = require('node:path');
const fs = require('node:fs');
process.env.DOTENV_CONFIG_PATH = path.join(__dirname, '.nonexistent-diagnostic-env');
process.env.DOTENV_CONFIG_QUIET = 'true';
const declarations = fs.readFileSync(path.join(__dirname, '../../src/config/envs.ts'), 'utf8');
for (const match of declarations.matchAll(/^    ([A-Z][A-Z_]+):/gm)) {
  delete process.env[match[1]];
}
Object.assign(process.env, {
  NODE_ENV: 'test', PORT: '0', FRONTEND_URL: 'http://localhost:5173',
  DATABASE_TYPE: 'mysql', DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '1',
  DATABASE_USER: 'diagnostic', DATABASE_PASSWORD: 'diagnostic-only',
  DATABASE_NAME: 'bibliolink_diagnostic', PASSWORD_HASH_ROUNDS: '10',
  JWT_ACCESS_SECRET: 'diagnostic-access-secret-0000000000000000',
  JWT_REFRESH_SECRET: 'diagnostic-refresh-secret-000000000000000',
  JWT_ACCESS_EXPIRES_IN: '900', JWT_REFRESH_EXPIRES_IN: '604800',
  AUTH_COOKIE_MAX_AGE: '900000', REFRESH_COOKIE_MAX_AGE: '604800000',
  BREVO_API_KEY: 'diagnostic-only', EMAIL_SENDER_EMAIL: 'test@example.com',
  EMAIL_PASSWORD_RESET_TEMPLATE_ID: '1', CAPTCHA_SECRET_KEY: 'diagnostic-only',
  PAYMENT_CLIENT_ID: 'diagnostic-only', PAYMENT_CLIENT_SECRET: 'diagnostic-only',
  PAYMENT_BASE_URL: 'http://127.0.0.1:1', PAYMENT_PLAN_ID: 'diagnostic-only',
  PAYMENT_WEBHOOK_ID: 'diagnostic-only', PAYMENT_CHECKOUT_REFERENCE_SECRET: 'd'.repeat(43),
  THROTTLE_TTL: '60000', THROTTLE_LIMIT: '1000',
  REGISTER_THROTTLE_TTL: '60000', REGISTER_THROTTLE_LIMIT: '1000',
  LOGIN_THROTTLE_TTL: '60000', LOGIN_THROTTLE_LIMIT: '1000',
  FORGOT_PASSWORD_THROTTLE_TTL: '60000', FORGOT_PASSWORD_THROTTLE_LIMIT: '1000',
  RESET_PASSWORD_THROTTLE_TTL: '60000', RESET_PASSWORD_THROTTLE_LIMIT: '1000',
  ADS_MYSQL_TESTS: '0', ANALYTICS_MYSQL_TESTS: '0',
});
// Additional CJS-process guard. Vitest may load TypeORM in a separate module
// realm; the primary boundary there remains the sanitized loopback-only config.
const { DataSource } = require('typeorm');
DataSource.prototype.initialize = async function () {
  throw new Error('Diagnostic safety boundary: real database initialization forbidden');
};
globalThis.fetch = async () => {
  throw new Error('Diagnostic safety boundary: external fetch forbidden');
};
