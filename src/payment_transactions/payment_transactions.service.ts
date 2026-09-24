import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EntityManager } from 'typeorm';

import { PaymentTransaction } from './entities/payment_transaction.entity';
import { PaymentTransactionStatus } from './enums/payment-transaction-status.enum';
import type { RecordSuccessfulPayment } from './interfaces/record-successful-payment.interface';

@Injectable()
export class PaymentTransactionsService {
    constructor(
        @InjectPinoLogger(PaymentTransactionsService.name)
        private readonly logger: PinoLogger,
    ) {}

    async recordSuccessfulPayment( manager: EntityManager, input: RecordSuccessfulPayment, ): Promise<PaymentTransaction> {
        const repository = manager.getRepository(PaymentTransaction);

        const existingPayment = await repository.findOne({
            where: {
                subscriptionId: input.subscriptionId,
                externalReference: input.externalReference,
            },
        });

        if (existingPayment) {
            if (
                existingPayment.status !== PaymentTransactionStatus.SUCCEEDED ||
                existingPayment.amount !== input.amount ||
                existingPayment.currencyCode !== input.currencyCode
            ) {
                throw new Error(
                    'El pago existente no coincide con el pago confirmado.',
                );
            }

            this.logger.debug(
                {
                    paymentTransactionId:
                        existingPayment.paymentTransactionId,
                },
                'Pago confirmado previamente registrado',
            );

            return existingPayment;
        }

        const payment = repository.create({
            subscriptionId: input.subscriptionId,
            externalReference: input.externalReference,
            status: PaymentTransactionStatus.SUCCEEDED,
            amount: input.amount,
            currencyCode: input.currencyCode,
            paidAt: input.paidAt,
        });

        const savedPayment = await repository.save(payment);

        this.logger.debug(
            {
                paymentTransactionId:
                    savedPayment.paymentTransactionId,
                subscriptionId: input.subscriptionId,
            },
            'Pago confirmado registrado',
        );

        return savedPayment;
    }
}