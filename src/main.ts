import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { envs } from './config/envs';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true, });

    // Detrás de un proxy (Vercel), la IP del socket es la del proxy y todos los
    // clientes compartirían el mismo contador de throttling. Con esto Express
    // toma la IP del cliente de X-Forwarded-For, solo desde los proxies indicados.
    app.set('trust proxy', envs.trustProxyHops);
    app.useLogger(app.get(Logger));
    app.use(cookieParser());

    app.enableCors({
        origin: envs.frontendUrl,
        credentials: true,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    app.useGlobalFilters(
        new HttpExceptionFilter(),
    );

    await app.listen(envs.port);
}

void bootstrap();
