import { Test, TestingModule } from '@nestjs/testing';
import { PaymentTransactionsController } from './payment_transactions.controller';
import { PaymentTransactionsService } from './payment_transactions.service';

describe('PaymentTransactionsController', () => {
  let controller: PaymentTransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentTransactionsController],
      providers: [PaymentTransactionsService],
    }).compile();

    controller = module.get<PaymentTransactionsController>(PaymentTransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
