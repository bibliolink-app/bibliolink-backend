import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PaymentTransactionsService } from './payment_transactions.service';
import { CreatePaymentTransactionDto } from './dto/create-payment_transaction.dto';
import { UpdatePaymentTransactionDto } from './dto/update-payment_transaction.dto';

@Controller('payment-transactions')
export class PaymentTransactionsController {
  constructor(private readonly paymentTransactionsService: PaymentTransactionsService) {}

  @Post()
  create(@Body() createPaymentTransactionDto: CreatePaymentTransactionDto) {
    return this.paymentTransactionsService.create(createPaymentTransactionDto);
  }

  @Get()
  findAll() {
    return this.paymentTransactionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentTransactionsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaymentTransactionDto: UpdatePaymentTransactionDto) {
    return this.paymentTransactionsService.update(+id, updatePaymentTransactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentTransactionsService.remove(+id);
  }
}
