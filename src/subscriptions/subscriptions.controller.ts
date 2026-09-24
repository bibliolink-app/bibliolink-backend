import {
    BadRequestException,
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import type {
    AuthenticatedUser,
} from '../auth/interfaces/authenticated-user.interface';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ConfirmSubscriptionDto } from './dto/confirm-subscription.dto';

import { SubscriptionsService } from './subscriptions.service';
import {  SkipThrottle, } from '@nestjs/throttler';

type AuthenticatedRequest = Request & {
    user: AuthenticatedUser;
};

@Controller('subscriptions')
export class SubscriptionsController {
    constructor(
        private readonly subscriptionsService: SubscriptionsService,
    ) { }

    // 1. Crear la reserva interna de suscripción.
    @Post()
    @UseGuards(JwtAuthGuard)
    
    async reserveSubscription(
        @Req() request: AuthenticatedRequest,
    ): Promise<{
        subscriptionId: number;
        checkoutReference: string;
    }> {
        return this.subscriptionsService.reservePendingSubscription(
            request.user.userId,
        );
    }

    // 2. Vincular la suscripción aprobada en PayPal.
    @Post('confirm')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(JwtAuthGuard)
    async confirmSubscription(@Req() request: AuthenticatedRequest, @Body() dto: ConfirmSubscriptionDto,): Promise<void> {
        await this.subscriptionsService.linkApprovedSubscription(
            request.user.userId,
            dto.subscriptionId,
            dto.externalSubscriptionReference,
        );
    }

    // 3. Recibir las notificaciones de PayPal.
    @Post('webhooks/paypal')
    @HttpCode(HttpStatus.NO_CONTENT)
    @SkipThrottle()
    async receivePayPalWebhook(@Req() request: RawBodyRequest<Request>,): Promise<void> {
        if (!request.rawBody?.length) {
            throw new BadRequestException(
                'El cuerpo de la notificación está vacío.',
            );
        }

        await this.subscriptionsService.processPaymentWebhook({
            rawBody: request.rawBody,
            headers: request.headers,
        });
    }
}