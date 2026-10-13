import { Controller, MessageEvent, Req, Sse, UseGuards, } from '@nestjs/common';

import type { Request } from 'express';
import { map, Observable } from 'rxjs';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

import { SubscriptionEventStream } from './events/subscription-event-stream.service';

type AuthenticatedRequest = Request & {
    user: AuthenticatedUser;
};

@Controller('subscriptions')
export class SubscriptionEventsController {
    constructor(
        private readonly subscriptionEventStream: SubscriptionEventStream,
    ) { }

    @Sse('events')
    @UseGuards(JwtAuthGuard)
    events(@Req() request: AuthenticatedRequest,): Observable<MessageEvent> {
        return this.subscriptionEventStream
            .streamForUser(request.user.userId)
            .pipe(
                map((event): MessageEvent => {
                    switch (event.kind) {
                        case 'SUBSCRIPTION_ACTIVATED':
                            return {
                                type: 'subscription.activated',
                                data: event.data,
                            };
                        case 'SUBSCRIPTION_CANCELED':
                            return {
                                type: 'subscription.canceled',
                                data: event.data,
                            };
                        case 'HEARTBEAT':
                            return {
                                type: 'heartbeat',
                                data: {},
                            };
                    }
                }),
            );
    }
}