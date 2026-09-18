import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectPinoLogger(SubscriptionsService.name)
    private readonly logger: PinoLogger,
  ) {}

  create(createSubscriptionDto: CreateSubscriptionDto) {
    this.logger.debug({ operation: 'create' }, 'Subscription scaffold method completed without persistence');
    return 'This action adds a new subscription';
  }

  findAll() {
    this.logger.debug({ operation: 'findAll' }, 'Subscription scaffold method completed without persistence');
    return `This action returns all subscriptions`;
  }

  findOne(id: number) {
    this.logger.debug({ subscriptionId: id, operation: 'findOne' }, 'Subscription scaffold method completed without persistence');
    return `This action returns a #${id} subscription`;
  }

  update(id: number, updateSubscriptionDto: UpdateSubscriptionDto) {
    this.logger.debug({ subscriptionId: id, operation: 'update' }, 'Subscription scaffold method completed without persistence');
    return `This action updates a #${id} subscription`;
  }

  remove(id: number) {
    this.logger.debug({ subscriptionId: id, operation: 'remove' }, 'Subscription scaffold method completed without persistence');
    return `This action removes a #${id} subscription`;
  }
}
