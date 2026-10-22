import { Controller } from '@nestjs/common';
import { PaymentTransactionsService } from './payment_transactions.service';

@Controller('payment-transactions')
export class PaymentTransactionsController {
  constructor(private readonly paymentTransactionsService: PaymentTransactionsService) {}
}
