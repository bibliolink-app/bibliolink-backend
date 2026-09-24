import 'dotenv/config';

import * as joi from 'joi';

interface EnvVars {
    // APPLICATION
    NODE_ENV: 'development' | 'production' | 'test';
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
    JWT_ACCESS_EXPIRES_IN: number;

    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRES_IN: number;

    AUTH_COOKIE_MAX_AGE: number;
    REFRESH_COOKIE_MAX_AGE: number;

    // EMAIL / BREVO
    BREVO_API_KEY: string;
    EMAIL_SENDER_EMAIL: string;
    EMAIL_SENDER_NAME: string;
    EMAIL_PASSWORD_RESET_TEMPLATE_ID: number;

    // PASSWORD RESET
    PASSWORD_RESET_TOKEN_TTL_MINUTES: number;

    // CAPTCHA
    CAPTCHA_SECRET_KEY: string;

    // PAYMENTS
    PAYMENT_CLIENT_ID: string;
    PAYMENT_CLIENT_SECRET: string;
    PAYMENT_BASE_URL: string;

    PAYMENT_PLAN_ID: string;

    PAYMENT_WEBHOOK_ID: string;
    PAYMENT_CHECKOUT_REFERENCE_SECRET: string;

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

const envsSchema = joi.object<EnvVars>({
    // APPLICATION
    NODE_ENV: joi.string().valid('development', 'production', 'test').default('development'),
    PORT: joi.number().port().default(3000),
    FRONTEND_URL: joi.string().uri().required(),

    // DATABASE
    DATABASE_TYPE: joi.string().valid('mysql').required(),
    DATABASE_HOST: joi.string().required(),
    DATABASE_PORT: joi.number().port().required(),
    DATABASE_USER: joi.string().required(),
    DATABASE_PASSWORD: joi.string().required(),
    DATABASE_NAME: joi.string().required(),

    // PASSWORD HASHING
    PASSWORD_HASH_ROUNDS: joi.number().integer().min(10).max(15).default(10),

    // AUTHENTICATION
    JWT_ACCESS_SECRET: joi.string().min(32).required(),
    JWT_ACCESS_EXPIRES_IN: joi.number().integer().positive().required(),

    JWT_REFRESH_SECRET: joi.string().min(32).invalid(joi.ref('JWT_ACCESS_SECRET')).required(),
    JWT_REFRESH_EXPIRES_IN: joi.number().integer().positive().required(),

    AUTH_COOKIE_MAX_AGE: joi.number().integer().positive().required(),
    REFRESH_COOKIE_MAX_AGE: joi.number().integer().positive().required(),

    // EMAIL / BREVO
    BREVO_API_KEY: joi.string().required(),
    EMAIL_SENDER_EMAIL: joi.string().email().required(),
    EMAIL_SENDER_NAME: joi.string().default('BiblioLink'),
    EMAIL_PASSWORD_RESET_TEMPLATE_ID: joi.number().integer().positive().required(),

    // PASSWORD RESET
    PASSWORD_RESET_TOKEN_TTL_MINUTES: joi.number().integer().positive().default(15),

    // CAPTCHA
    CAPTCHA_SECRET_KEY: joi.string().required(),

    // PAYMENTS
    PAYMENT_CLIENT_ID: joi.string().required(),
    PAYMENT_CLIENT_SECRET: joi.string().required(),
    PAYMENT_BASE_URL: joi.string().uri().required(),
    PAYMENT_PLAN_ID: joi.string().required(),
    PAYMENT_WEBHOOK_ID: joi.string().allow('').default(''),
    PAYMENT_CHECKOUT_REFERENCE_SECRET: joi.string().pattern(/^[A-Za-z0-9_-]{43}$/).required(),

    // THROTTLING (TTL en milisegundos)
    THROTTLE_TTL: joi.number().integer().positive().required(),
    THROTTLE_LIMIT: joi.number().integer().positive().required(),
    REGISTER_THROTTLE_TTL: joi.number().integer().positive().required(),
    REGISTER_THROTTLE_LIMIT: joi.number().integer().positive().required(),
    LOGIN_THROTTLE_TTL: joi.number().integer().positive().required(),
    LOGIN_THROTTLE_LIMIT: joi.number().integer().positive().required(),
    FORGOT_PASSWORD_THROTTLE_TTL: joi.number().integer().positive().required(),
    FORGOT_PASSWORD_THROTTLE_LIMIT: joi.number().integer().positive().required(),
    RESET_PASSWORD_THROTTLE_TTL: joi.number().integer().positive().required(),
    RESET_PASSWORD_THROTTLE_LIMIT: joi.number().integer().positive().required(),
}).unknown(true);

const validationResult = envsSchema.validate(process.env, {
    abortEarly: false,
    convert: true,
});

if (validationResult.error) {
    throw new Error(
        `Config validation error: ${validationResult.error.message}`,
    );
}

const envVars = validationResult.value as EnvVars;

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

    // PASSWORD HASHING
    passwordHash: {
        rounds: envVars.PASSWORD_HASH_ROUNDS,
    },

    // AUTHENTICATION
    jwt: {
        access: {
            secret: envVars.JWT_ACCESS_SECRET,
            expiresIn: envVars.JWT_ACCESS_EXPIRES_IN,
        },
        refresh: {
            secret: envVars.JWT_REFRESH_SECRET,
            expiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
        },
    },

    cookies: {
        authMaxAge: envVars.AUTH_COOKIE_MAX_AGE,
        refreshMaxAge: envVars.REFRESH_COOKIE_MAX_AGE,
    },

    // EMAIL
    email: {
        senderEmail: envVars.EMAIL_SENDER_EMAIL,
        senderName: envVars.EMAIL_SENDER_NAME,
        passwordResetTemplateId: envVars.EMAIL_PASSWORD_RESET_TEMPLATE_ID,
    },

    // BREVO
    brevo: {
        apiKey: envVars.BREVO_API_KEY,
    },

    // PASSWORD RESET
    passwordReset: {
        tokenTtlMinutes: envVars.PASSWORD_RESET_TOKEN_TTL_MINUTES,
    },

    // CAPTCHA
    captcha: {
        secretKey: envVars.CAPTCHA_SECRET_KEY,
    },

    // PAYMENTS
    payments: {
        clientId: envVars.PAYMENT_CLIENT_ID,
        clientSecret: envVars.PAYMENT_CLIENT_SECRET,
        baseUrl: envVars.PAYMENT_BASE_URL,
        planId: envVars.PAYMENT_PLAN_ID,
        webhookId: envVars.PAYMENT_WEBHOOK_ID,
        checkoutReferenceSecret: envVars.PAYMENT_CHECKOUT_REFERENCE_SECRET,
    },

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
