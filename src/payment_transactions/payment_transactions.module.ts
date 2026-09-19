import { Module } from '@nestjs/common';
import { PaymentTransactionsService } from './payment_transactions.service';
import { PaymentTransactionsController } from './payment_transactions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentTransaction } from './entities/payment_transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentTransaction])],
  controllers: [PaymentTransactionsController],
  providers: [PaymentTransactionsService],
})
export class PaymentTransactionsModule {}
