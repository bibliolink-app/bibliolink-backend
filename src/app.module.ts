import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { databaseConnectionOptions, databaseRetryOptions, } from './config/database.config';
import { throttlingConfig } from './config/throttling.config';
import { loggingConfig } from './config/logging.config';
import { EmailModule } from './email/email.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { BooksModule } from './books/books.module';
import { FavoritesModule } from './favorites/favorites.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AuthModule } from './auth/auth.module';
import { PaymentTransactionsModule } from './payment_transactions/payment_transactions.module';
import { AdsModule } from './ads/ads.module';
import { ReadingModule } from './reading/reading.module';
import { SeedModule } from './seed/seed.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CategoriesModule } from './categories/categories.module';
import { HealthModule } from './health/health.module';

@Module({
    imports: [
        LoggerModule.forRoot(loggingConfig),
        TypeOrmModule.forRoot({
            ...databaseConnectionOptions,
            ...databaseRetryOptions,
            autoLoadEntities: true,
        }),

        ThrottlerModule.forRoot(throttlingConfig),
        AuthModule,
        EmailModule,
        CatalogsModule,
        BooksModule,
        FavoritesModule,
        SubscriptionsModule,
        PaymentTransactionsModule,
        SeedModule,
        AdsModule,
        ReadingModule,
        AnalyticsModule,
        CategoriesModule,
        HealthModule,
    ],

    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})

export class AppModule { }
