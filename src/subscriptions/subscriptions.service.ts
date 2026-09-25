import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { In, MoreThan, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import { PAYMENT_PROVIDER, type PaymentProvider, } from './interfaces/payment-provider.interface';
import { PaymentTransactionsService } from '../payment_transactions/payment_transactions.service';
import { PaymentTransaction } from '../payment_transactions/entities/payment_transaction.entity';

import type { ConfirmedSubscriptionPayment, } from './interfaces/confirmed-subscription-payment.interface';
import type { PaymentWebhookRequest, } from './interfaces/payment-provider.interface';
import { SubscriptionPaymentEvent } from './interfaces/subscription-payment-event.interface';
import { envs } from '../config/envs';

import { createSubscriptionCheckoutReference, getSubscriptionIdFromCheckoutReference, verifySubscriptionCheckoutReference, } from './utils/subscription-checkout-reference.util';
import { SubscriptionEventStream } from './events/subscription-event-stream.service';
import { SubscriptionActivatedEvent, SubscriptionCanceledEvent } from './events/subscription-activated.event';

const PAYMENT_TIME_TOLERANCE_MS = 5 * 60 * 1000;
const PRO_MONTHLY_AMOUNT_CENTS = 500;
const PRO_CURRENCY_CODE = 'USD';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,

    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,

    private readonly paymentTransactionsService: PaymentTransactionsService,

    private readonly subscriptionEventStream: SubscriptionEventStream,

    @InjectPinoLogger(SubscriptionsService.name)
    private readonly logger: PinoLogger,
  ) { }

  //Crea la reserva local PENDING para el usuario autenticado.
  async reservePendingSubscription(
    userId: number,
  ): Promise<{
    subscriptionId: number;
    checkoutReference: string;
  }> {
    return this.subscriptionRepository.manager.transaction(
      async (manager) => {
        const userRepository = manager.getRepository(User);
        const subscriptionRepository =
          manager.getRepository(Subscription);

        // Serializamos las solicitudes del mismo usuario.
        const user = await userRepository
          .createQueryBuilder('user')
          .setLock('pessimistic_write')
          .where('user.userId = :userId', { userId })
          .getOne();

        if (!user) {
          throw new NotFoundException(
            'El usuario no existe.',
          );
        }

        if (user.status !== UserStatus.ACTIVE) {
          throw new ForbiddenException(
            'La cuenta no está activa.',
          );
        }

        // Una reserva pendiente o una suscripción vigente
        // impide iniciar otra suscripción.
        const existingSubscription =
          await subscriptionRepository.findOne({
            where: [
              {
                userId,
                status: In([
                  SubscriptionStatus.PENDING,
                  SubscriptionStatus.ACTIVE,
                  SubscriptionStatus.PAST_DUE,
                ]),
              },
              {
                userId,
                status: SubscriptionStatus.CANCELED,
                currentPeriodEnd: MoreThan(new Date()),
              },
            ],
          });

        if (existingSubscription) {
          throw new ConflictException(
            'El usuario ya tiene una suscripción vigente o en proceso.',
          );
        }

        const subscription = subscriptionRepository.create({
          userId,
          status: SubscriptionStatus.PENDING,
          externalSubscriptionReference: null,
          startedAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          canceledAt: null,
        });

        const savedSubscription =
          await subscriptionRepository.save(subscription);

        this.logger.debug(
          {
            subscriptionId: savedSubscription.subscriptionId,
            userId,
          },
          'Reserva de suscripción pendiente creada',
        );

        return {
          subscriptionId: savedSubscription.subscriptionId,
          checkoutReference:
            createSubscriptionCheckoutReference(
              savedSubscription.subscriptionId,
              userId,
              envs.payments.checkoutReferenceSecret,
            ),
        };
      },
    );
  }


  //Consulta PayPal, valida la suscripción y la relaciona con la reserva.
  async linkApprovedSubscription(userId: number, subscriptionId: number, externalSubscriptionReference: string,): Promise<void> {

    if (!Number.isSafeInteger(subscriptionId) || subscriptionId <= 0 || !externalSubscriptionReference?.trim()) {
      throw new BadRequestException(
        'Los datos de la suscripción son inválidos.',
      );
    }

    // Comprobamos que la reserva pertenece al usuario autenticado.
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        subscriptionId,
        userId,
      },
    });

    if (!subscription) {
      throw new NotFoundException(
        'No se encontró la reserva de suscripción.',
      );
    }

    // Consultamos PayPal; no confiamos únicamente en React.
    const externalSubscription = await this.paymentProvider.getSubscriptionIdentity(
      externalSubscriptionReference,
    );

    const referenceSubscriptionId = getSubscriptionIdFromCheckoutReference(
      externalSubscription.checkoutReference,
    );

    if (referenceSubscriptionId !== subscriptionId) {
      throw new ForbiddenException(
        'La suscripción de PayPal no corresponde a la reserva solicitada.',
      );
    }

    if (externalSubscription.status !== 'APPROVED' && externalSubscription.status !== 'ACTIVE') {
      throw new ConflictException(
        'La suscripción todavía no ha sido aprobada en PayPal.',
      );
    }

    await this.persistVerifiedSubscriptionLink(
      subscriptionId,
      externalSubscriptionReference,
      externalSubscription.checkoutReference,
      userId,
    );
  }


  //Verifica que el webhook sea auténtico.
  async processPaymentWebhook(input: PaymentWebhookRequest,): Promise<void> {
    const event = await this.paymentProvider.parseVerifiedWebhook(input);

    await this.processSubscriptionEvent(event);
  }

  //Determina si ocurrió un pago o una cancelación.
  async processSubscriptionEvent(event: SubscriptionPaymentEvent,): Promise<void> {
    await this.ensureWebhookSubscriptionLinked(
      event.externalSubscriptionReference,
    );
    switch (event.type) {
      case 'SUBSCRIPTION_CANCELED':
        await this.registerSubscriptionCancellation(
          event.externalSubscriptionReference,
        );
        return;

      case 'PAYMENT_SUCCEEDED': {
        // Confirmamos directamente con el proveedor que
        // el cobro realmente existe y está completado.
        const confirmedPayment = await this.paymentProvider.getConfirmedPayment(
          event.externalSubscriptionReference,
          event.externalPaymentReference,
          event.paidAt,
        );

        // Consultamos la información actual de facturación
        // de la suscripción.
        const billingInfo =
          await this.paymentProvider.getSubscriptionBillingInfo(
            event.externalSubscriptionReference,
          );

        if (
          !billingInfo.lastPaymentAt ||
          !billingInfo.nextBillingTime
        ) {
          throw new ServiceUnavailableException(
            'No fue posible determinar la vigencia del pago confirmado.',
          );
        }

        // Evitamos asociar accidentalmente un webhook antiguo
        // con la información de un pago mensual posterior.
        const paymentTimeDifference = Math.abs(
          billingInfo.lastPaymentAt.getTime() -
          confirmedPayment.paidAt.getTime(),
        );

        if (
          paymentTimeDifference >
          PAYMENT_TIME_TOLERANCE_MS
        ) {
          throw new ServiceUnavailableException(
            'La información de facturación no corresponde al pago procesado.',
          );
        }

        await this.confirmSuccessfulPayment({
          externalSubscriptionReference:
            event.externalSubscriptionReference,

          externalPaymentReference:
            confirmedPayment.externalReference,

          amount:
            confirmedPayment.amount,

          currencyCode:
            confirmedPayment.currencyCode,

          paidAt:
            confirmedPayment.paidAt,

          periodStart:
            billingInfo.lastPaymentAt,

          periodEnd:
            billingInfo.nextBillingTime,
        });

        return;
      }
    }
  }

  //Actualizan nuestra información de manera transaccional.
 async confirmSuccessfulPayment( input: ConfirmedSubscriptionPayment, ): Promise<void> {
    if (
        !input.externalSubscriptionReference ||
        !input.externalPaymentReference ||
        !Number.isFinite(input.paidAt.getTime()) ||
        !Number.isFinite(input.periodStart.getTime()) ||
        !Number.isFinite(input.periodEnd.getTime()) ||
        input.periodEnd <= input.periodStart
    ) {
        throw new Error(
            'Los datos del pago confirmado son inválidos.',
        );
    }

    const amountParts =
        /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.amount);

    if (!amountParts) {
        throw new UnprocessableEntityException(
            'El importe del pago confirmado es inválido.',
        );
    }

    const amountCents =
        Number(amountParts[1]) * 100 +
        Number((amountParts[2] ?? '').padEnd(2, '0'));

    if (
        !Number.isSafeInteger(amountCents) ||
        amountCents !== PRO_MONTHLY_AMOUNT_CENTS ||
        input.currencyCode !== PRO_CURRENCY_CODE
    ) {
        throw new UnprocessableEntityException(
            'El pago no corresponde al importe del plan BiblioLink Pro.',
        );
    }

    const activationEvent = await this.subscriptionRepository.manager.transaction<SubscriptionActivatedEvent | null>(async (manager) => {
            const subscriptionRepository = manager.getRepository(Subscription);

            const paymentRepository =  manager.getRepository(PaymentTransaction);

            // Bloqueamos la suscripción para que dos webhooks concurrentes
            // no modifiquen el mismo período al mismo tiempo.
            const subscription = await subscriptionRepository
                .createQueryBuilder('subscription')
                .setLock('pessimistic_write')
                .where(
                    'subscription.externalSubscriptionReference = :reference',
                    {
                        reference:
                            input.externalSubscriptionReference,
                    },
                )
                .getOne();

            if (!subscription) {
                throw new Error(
                    'No se encontró la suscripción asociada al pago.',
                );
            }

            // Necesitamos saber el estado anterior para publicar SSE
            // solamente cuando realmente ocurra PENDING -> ACTIVE.
            const wasPending = subscription.status === SubscriptionStatus.PENDING;

            // Verificamos si el cobro ya fue procesado.
            const existingPayment =
                await paymentRepository.findOne({
                    where: {
                        subscriptionId:
                            subscription.subscriptionId,
                        externalReference:
                            input.externalPaymentReference,
                    },
                });

            if (existingPayment) {
                // El servicio valida que un webhook duplicado
                // coincida con el pago que ya tenemos registrado.
                await this.paymentTransactionsService
                    .recordSuccessfulPayment(manager, {
                        subscriptionId:
                            subscription.subscriptionId,
                        externalReference:
                            input.externalPaymentReference,
                        amount: input.amount,
                        currencyCode: input.currencyCode,
                        paidAt: input.paidAt,
                    });

                // No volvemos a emitir el evento SSE.
                return null;
            }

            // Registramos el cobro.
            await this.paymentTransactionsService
                .recordSuccessfulPayment(manager, {
                    subscriptionId:
                        subscription.subscriptionId,
                    externalReference:
                        input.externalPaymentReference,
                    amount: input.amount,
                    currencyCode: input.currencyCode,
                    paidAt: input.paidAt,
                });

            // Un webhook antiguo no debe reducir una vigencia
            // que ya fue extendida por un pago posterior.
            const extendsCurrentPeriod =
                !subscription.currentPeriodEnd ||
                input.periodEnd > subscription.currentPeriodEnd;

            if (!extendsCurrentPeriod) {
                return null;
            }

            subscription.currentPeriodStart =
                input.periodStart;

            subscription.currentPeriodEnd =
                input.periodEnd;

            if (!subscription.startedAt) {
                subscription.startedAt =
                    input.periodStart;
            }

            // Un webhook de pago atrasado no debe reactivar
            // una suscripción cancelada o expirada.
            if (
                subscription.status !==
                    SubscriptionStatus.CANCELED &&
                subscription.status !==
                    SubscriptionStatus.EXPIRED &&
                input.periodEnd > new Date()
            ) {
                subscription.status =
                    SubscriptionStatus.ACTIVE;
            }

            await subscriptionRepository.save(subscription);

            // Renovaciones ACTIVE -> ACTIVE no deben provocar
            // nuevamente "tu suscripción fue activada".
            if (
                !wasPending ||
                subscription.status !==
                    SubscriptionStatus.ACTIVE
            ) {
                return null;
            }

            return {
                userId: subscription.userId,
                subscriptionId:
                    subscription.subscriptionId,
                currentPeriodEnd:
                    subscription.currentPeriodEnd,
            };
        });

    // Si llegamos aquí, la transacción ya terminó correctamente.
    // Por eso recién ahora notificamos por SSE.
    if (activationEvent) {
        this.subscriptionEventStream.publishActivation(
            activationEvent,
        );
    }
}

  async registerSubscriptionCancellation( externalSubscriptionReference: string, ): Promise<void> {
  const cancellationEvent =
    await this.subscriptionRepository.manager.transaction<SubscriptionCanceledEvent | null>(async (manager) => {
      const repository = manager.getRepository(Subscription);

      const subscription = await repository
        .createQueryBuilder('subscription')
        .setLock('pessimistic_write')
        .where(
          'subscription.externalSubscriptionReference = :reference',
          { reference: externalSubscriptionReference },
        )
        .getOne();

      if (!subscription) {
        throw new NotFoundException(
          'No se encontró la suscripción asociada a la cancelación.',
        );
      }

      // Webhook repetido: no modificamos ni notificamos nuevamente.
      if (subscription.status === SubscriptionStatus.CANCELED) {
        return null;
      }

      // Un evento atrasado no debe cambiar una suscripción expirada.
      if (subscription.status === SubscriptionStatus.EXPIRED) {
        return null;
      }

      subscription.status = SubscriptionStatus.CANCELED;
      subscription.canceledAt = new Date();

      await repository.save(subscription);

      return {
        userId: subscription.userId,
        subscriptionId: subscription.subscriptionId,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    });

  // La transacción ya hizo COMMIT.
  if (!cancellationEvent) {
    return;
  }

  this.subscriptionEventStream.publishCancellation(
    cancellationEvent,
  );

  this.logger.debug(
    {
      subscriptionId: cancellationEvent.subscriptionId,
      userId: cancellationEvent.userId,
      externalSubscriptionReference,
    },
    'Cancelación de suscripción registrada',
  );
}

  async hasPremiumAccess(userId: number): Promise<boolean> {
    const now = new Date();

    const subscription = await this.subscriptionRepository.findOne({
      where: [
        {
          userId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: MoreThan(now),
        },
        {
          userId,
          status: SubscriptionStatus.CANCELED,
          currentPeriodEnd: MoreThan(now),
        },
      ],
    });

    return subscription !== null;
  }


  private async ensureWebhookSubscriptionLinked(
    externalSubscriptionReference: string,
  ): Promise<void> {
    // Si ya está vinculada, no necesitamos repetir el proceso.
    const existingSubscription =
      await this.subscriptionRepository.findOne({
        where: {
          externalSubscriptionReference,
        },
      });

    if (existingSubscription) {
      return;
    }

    // El webhook llegó antes de la vinculación desde React.
    const externalSubscription =
      await this.paymentProvider.getSubscriptionIdentity(
        externalSubscriptionReference,
      );

    const subscriptionId =
      getSubscriptionIdFromCheckoutReference(
        externalSubscription.checkoutReference,
      );

    if (subscriptionId === null) {
      throw new ForbiddenException(
        'La notificación no contiene una referencia de reserva válida.',
      );
    }

    await this.persistVerifiedSubscriptionLink(
      subscriptionId,
      externalSubscriptionReference,
      externalSubscription.checkoutReference,
    );
  }

  private async persistVerifiedSubscriptionLink(
    subscriptionId: number,
    externalSubscriptionReference: string,
    checkoutReference: string,
    expectedUserId?: number,
  ): Promise<void> {
    await this.subscriptionRepository.manager.transaction(
      async (manager) => {
        const repository =
          manager.getRepository(Subscription);

        const subscription = await repository
          .createQueryBuilder('subscription')
          .setLock('pessimistic_write')
          .where(
            'subscription.subscriptionId = :subscriptionId',
            { subscriptionId },
          )
          .getOne();

        if (!subscription) {
          throw new NotFoundException(
            'No se encontró la reserva de suscripción.',
          );
        }

        // Cuando la petición viene de React, comprobamos
        // nuevamente la propiedad dentro de la transacción.
        if (
          expectedUserId !== undefined &&
          subscription.userId !== expectedUserId
        ) {
          throw new ForbiddenException(
            'La suscripción no pertenece al usuario autenticado.',
          );
        }

        // Verificamos que la referencia fue firmada
        // para esta reserva y su propietario.
        const validReference =
          verifySubscriptionCheckoutReference(
            checkoutReference,
            subscription.subscriptionId,
            subscription.userId,
            envs.payments.checkoutReferenceSecret,
          );

        if (!validReference) {
          throw new ForbiddenException(
            'La referencia de checkout no es válida.',
          );
        }

        // Una reserva no puede cambiar de suscripción externa.
        if (
          subscription.externalSubscriptionReference &&
          subscription.externalSubscriptionReference !==
          externalSubscriptionReference
        ) {
          throw new ConflictException(
            'La reserva ya está vinculada a otra suscripción.',
          );
        }

        // Permite que React y el webhook ejecuten
        // la misma vinculación sin duplicarla.
        if (
          subscription.externalSubscriptionReference ===
          externalSubscriptionReference
        ) {
          return;
        }

        if (
          subscription.status !==
          SubscriptionStatus.PENDING
        ) {
          throw new ConflictException(
            'La reserva ya no permite vincular una suscripción.',
          );
        }

        subscription.externalSubscriptionReference =
          externalSubscriptionReference;

        await repository.save(subscription);
      },
    );

    this.logger.debug(
      {
        subscriptionId,
        externalSubscriptionReference,
      },
      'Suscripción externa vinculada correctamente.',
    );
  }
}