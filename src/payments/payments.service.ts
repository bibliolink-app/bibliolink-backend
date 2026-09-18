import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectPinoLogger(PaymentsService.name)
    private readonly logger: PinoLogger,
  ) {}

  create(createPaymentDto: CreatePaymentDto) {
    this.logger.debug({ operation: 'create' }, 'Payment scaffold method completed without persistence');
    return 'This action adds a new payment';
  }

  findAll() {
    this.logger.debug({ operation: 'findAll' }, 'Payment scaffold method completed without persistence');
    return `This action returns all payments`;
  }

  findOne(id: number) {
    this.logger.debug({ paymentId: id, operation: 'findOne' }, 'Payment scaffold method completed without persistence');
    return `This action returns a #${id} payment`;
  }

  update(id: number, updatePaymentDto: UpdatePaymentDto) {
    this.logger.debug({ paymentId: id, operation: 'update' }, 'Payment scaffold method completed without persistence');
    return `This action updates a #${id} payment`;
  }

  remove(id: number) {
    this.logger.debug({ paymentId: id, operation: 'remove' }, 'Payment scaffold method completed without persistence');
    return `This action removes a #${id} payment`;
  }
}
