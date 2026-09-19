import { Module } from '@nestjs/common';
import { PaymentTransactionsService } from './payment_transactions.service';
import { PaymentTransactionsController } from './payment_transactions.controller';

@Module({
  controllers: [PaymentTransactionsController],
  providers: [PaymentTransactionsService],
})
export class PaymentTransactionsModule {}
