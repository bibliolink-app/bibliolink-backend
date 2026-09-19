import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { envs } from './config/envs';
import { throttlingConfig } from './config/throttling.config';
import { loggingConfig } from './config/logging.config';
import { EmailModule } from './email/email.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { BooksModule } from './books/books.module';
import { FavoritesModule } from './favorites/favorites.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AuthModule } from './auth/auth.module';
import { PaymentTransactionsModule } from './payment_transactions/payment_transactions.module';

@Module({
    imports: [
        LoggerModule.forRoot(loggingConfig),
        TypeOrmModule.forRoot({
            type: envs.database.type,
            host: envs.database.host,
            port: envs.database.port,
            username: envs.database.user,
            password: envs.database.password,
            database: envs.database.name,
            synchronize: true,
            autoLoadEntities: true,
            timezone: 'Z',
            dateStrings: false,
        }),

        ThrottlerModule.forRoot(throttlingConfig),
        AuthModule,

        EmailModule,

        CatalogsModule,

        BooksModule,

        FavoritesModule,

        SubscriptionsModule,

        
        PaymentTransactionsModule,
    ],

    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})

export class AppModule { }
