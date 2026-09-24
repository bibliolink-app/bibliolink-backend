import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { PaymentTransactionsModule } from '../payment_transactions/payment_transactions.module';

import { Subscription } from './entities/subscription.entity';
import { PAYMENT_PROVIDER } from './interfaces/payment-provider.interface';
import { PayPalProvider } from './providers/paypal.provider';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Subscription]),
        PaymentTransactionsModule,
        AuthModule,

        PassportModule.register({
            defaultStrategy: 'jwt',
        }),
    ],
    controllers: [
        SubscriptionsController,
    ],
    providers: [
        SubscriptionsService,
        PayPalProvider,
        {
            provide: PAYMENT_PROVIDER,
            useExisting: PayPalProvider,
        },
    ],
})
export class SubscriptionsModule {}