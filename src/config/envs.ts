import 'dotenv/config';

import * as joi from 'joi';

type NodeEnvironment = 'development' | 'test' | 'production';

type DurationUnit =
    | 'ms'
    | 's'
    | 'm'
    | 'h'
    | 'd'
    | 'w'
    | 'y';

type DurationString = `${number}${DurationUnit}`;

interface EnvVars {
    // APPLICATION
    NODE_ENV: NodeEnvironment;
    PORT: number;
    FRONTEND_URL: string;
    // DATABASE
    DATABASE_TYPE: 'mysql';
    DATABASE_HOST: string;
    DATABASE_PORT: number;
    DATABASE_USER: string;
    DATABASE_PASSWORD: string;
    DATABASE_NAME: string;
    // PASSWORD HASHING
    PASSWORD_HASH_ROUNDS: number;
    // AUTHENTICATION
    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_EXPIRES_IN: DurationString;

    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRES_IN: DurationString;
    // EMAIL / BREVO
    BREVO_API_KEY: string;
    BREVO_SENDER_EMAIL: string;
    BREVO_SENDER_NAME: string;
    BREVO_PASSWORD_RESET_TEMPLATE_ID: number;
    // PASSWORD RESET
    PASSWORD_RESET_TOKEN_TTL_MINUTES: number;
    // CAPTCHA
    CAPTCHA_SECRET_KEY: string;
// THROTTLING
THROTTLE_TTL: number;
THROTTLE_LIMIT: number;
REGISTER_THROTTLE_TTL: number;
REGISTER_THROTTLE_LIMIT: number;
LOGIN_THROTTLE_TTL: number;
LOGIN_THROTTLE_LIMIT: number;
FORGOT_PASSWORD_THROTTLE_TTL: number;
FORGOT_PASSWORD_THROTTLE_LIMIT: number;
RESET_PASSWORD_THROTTLE_TTL: number;
RESET_PASSWORD_THROTTLE_LIMIT: number;
}

const durationPattern = /^\d+(ms|s|m|h|d|w|y)$/;

const envsSchema: joi.ObjectSchema<EnvVars> = joi
    .object<EnvVars>({
        // APPLICATION
        NODE_ENV: joi.string<NodeEnvironment>().valid('development', 'test', 'production').default('development'),

        PORT: joi.number().port().default(3000),

        FRONTEND_URL: joi.string().uri().required(),
        // DATABASE

        DATABASE_TYPE: joi.string<'mysql'>().valid('mysql').required(),

        DATABASE_HOST: joi.string().required(),

        DATABASE_PORT: joi.number().port().required(),

        DATABASE_USER: joi.string().required(),

        DATABASE_PASSWORD: joi.string().required(),

        DATABASE_NAME: joi.string().required(),
        // PASSWORD HASHING
        PASSWORD_HASH_ROUNDS: joi.number().integer().min(10).max(15).default(10),
        // AUTHENTICATION

        JWT_ACCESS_SECRET: joi.string().min(32).required(),

        JWT_ACCESS_EXPIRES_IN: joi.string<DurationString>().pattern(durationPattern).default('15m'),

        JWT_REFRESH_SECRET: joi.string().min(32).required(),

        JWT_REFRESH_EXPIRES_IN: joi.string<DurationString>().pattern(durationPattern).default('7d'),
        // EMAIL / BREVO
        BREVO_API_KEY: joi.string().required(),

        BREVO_SENDER_EMAIL: joi.string().email().required(),

        BREVO_SENDER_NAME: joi.string().default('BiblioLink'),

        BREVO_PASSWORD_RESET_TEMPLATE_ID: joi.number().integer().positive().required(),
        // PASSWORD RESET
        PASSWORD_RESET_TOKEN_TTL_MINUTES: joi.number().integer().positive().default(15),
        // CAPTCHA
        CAPTCHA_SECRET_KEY: joi.string().required(),
        // THROTTLING
THROTTLE_TTL: joi.number().integer().positive().default(60000),

THROTTLE_LIMIT: joi.number().integer().positive().default(300),

REGISTER_THROTTLE_TTL: joi.number().integer().positive().default(900000),

REGISTER_THROTTLE_LIMIT: joi.number().integer().positive().default(5),

LOGIN_THROTTLE_TTL: joi.number().integer().positive().default(60000),

LOGIN_THROTTLE_LIMIT: joi.number().integer().positive().default(10),

FORGOT_PASSWORD_THROTTLE_TTL: joi.number().integer().positive().default(900000),

FORGOT_PASSWORD_THROTTLE_LIMIT: joi.number().integer().positive().default(3),

RESET_PASSWORD_THROTTLE_TTL: joi.number().integer().positive().default(900000),

RESET_PASSWORD_THROTTLE_LIMIT: joi.number().integer().positive().default(5),
    })
    .unknown(true);

   // Revisa las variables cargadas desde el entorno usando las reglas anteriores.
const envVars = joi.attempt(
    process.env,
    envsSchema,
    'Config validation error',
    {
        abortEarly: false,
        convert: true,
    },
);

export const envs = {
    // APPLICATION
    nodeEnv: envVars.NODE_ENV,
    port: envVars.PORT,
    frontendUrl: envVars.FRONTEND_URL,
    isProduction: envVars.NODE_ENV === 'production',
    // DATABASE
    database: {
        type: envVars.DATABASE_TYPE,
        host: envVars.DATABASE_HOST,
        port: envVars.DATABASE_PORT,
        user: envVars.DATABASE_USER,
        password: envVars.DATABASE_PASSWORD,
        name: envVars.DATABASE_NAME,
    },
    // AUTHENTICATION
    jwt: {
        access: { secret: envVars.JWT_ACCESS_SECRET, expiresIn: envVars.JWT_ACCESS_EXPIRES_IN, },
        refresh: { secret: envVars.JWT_REFRESH_SECRET, expiresIn: envVars.JWT_REFRESH_EXPIRES_IN, },
    },
    passwordHash: { rounds: envVars.PASSWORD_HASH_ROUNDS },
    // EMAIL
    email: {
        senderEmail: envVars.BREVO_SENDER_EMAIL,
        senderName: envVars.BREVO_SENDER_NAME,
        passwordResetTemplateId: envVars.BREVO_PASSWORD_RESET_TEMPLATE_ID,
    },
    // BREVO
    brevo: { apiKey: envVars.BREVO_API_KEY, },
    // PASSWORD RESET
    passwordReset: { tokenTtlMinutes: envVars.PASSWORD_RESET_TOKEN_TTL_MINUTES, },
    // CAPTCHA
    captcha: { secretKey: envVars.CAPTCHA_SECRET_KEY, },
    // THROTTLING
throttling: {
    global: {
        ttl: envVars.THROTTLE_TTL,
        limit: envVars.THROTTLE_LIMIT,
    },
    register: {
        ttl: envVars.REGISTER_THROTTLE_TTL,
        limit: envVars.REGISTER_THROTTLE_LIMIT,
    },
    login: {
        ttl: envVars.LOGIN_THROTTLE_TTL,
        limit: envVars.LOGIN_THROTTLE_LIMIT,
    },
    forgotPassword: {
        ttl: envVars.FORGOT_PASSWORD_THROTTLE_TTL,
        limit: envVars.FORGOT_PASSWORD_THROTTLE_LIMIT,
    },
    resetPassword: {
        ttl: envVars.RESET_PASSWORD_THROTTLE_TTL,
        limit: envVars.RESET_PASSWORD_THROTTLE_LIMIT,
    },
},
} as const;
