import { Injectable } from '@nestjs/common';
import { CreatePaymentTransactionDto } from './dto/create-payment_transaction.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment_transaction.dto';

@Injectable()
export class PaymentTransactionsService {
  create(createPaymentTransactionDto: CreatePaymentTransactionDto) {
    return 'This action adds a new paymentTransaction';
  }

  findAll() {
    return `This action returns all paymentTransactions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} paymentTransaction`;
  }

  update(id: number, updatePaymentTransactionDto: UpdatePaymentTransactionDto) {
    return `This action updates a #${id} paymentTransaction`;
  }

  remove(id: number) {
    return `This action removes a #${id} paymentTransaction`;
  }
}
