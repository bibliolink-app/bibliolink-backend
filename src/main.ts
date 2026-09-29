import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { envs } from './config/envs';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true, });
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
