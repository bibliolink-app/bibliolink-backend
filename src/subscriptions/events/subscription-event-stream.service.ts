import { Injectable } from '@nestjs/common';
import { filter, interval, map, merge, Observable, Subject, } from 'rxjs';

import type { SubscriptionActivatedEvent, SubscriptionCanceledEvent, SubscriptionCanceledStreamEvent, } from './subscription-activated.event';

import type { SubscriptionActivatedStreamEvent, SubscriptionStreamEvent, SseHeartbeatEvent, } from './subscription-activated.event';

@Injectable()
export class SubscriptionEventStream {
    private static readonly HEARTBEAT_INTERVAL_MS = 15_000;

    private readonly subscriptionActivated$ = new Subject<SubscriptionActivatedEvent>();

    private readonly subscriptionCanceled$ =
        new Subject<SubscriptionCanceledEvent>();

    publishActivation(event: SubscriptionActivatedEvent): void {
        this.subscriptionActivated$.next(event);
    }

    publishCancellation(event: SubscriptionCanceledEvent): void {
        this.subscriptionCanceled$.next(event);
    }

    streamForUser(userId: number): Observable<SubscriptionStreamEvent> {
        const activationEvents$ = this.activationsForUser(userId).pipe(
            map(
                (event): SubscriptionActivatedStreamEvent => ({
                    kind: 'SUBSCRIPTION_ACTIVATED',
                    data: {
                        subscriptionId: event.subscriptionId,
                        currentPeriodEnd: event.currentPeriodEnd,
                    },
                }),
            ),
        );

        const cancellationEvents$ = this.cancellationsForUser(userId).pipe(
            map(
                (event): SubscriptionCanceledStreamEvent => ({
                    kind: 'SUBSCRIPTION_CANCELED',
                    data: {
                        subscriptionId: event.subscriptionId,
                        currentPeriodEnd: event.currentPeriodEnd,
                    },
                }),
            ),
        );

        const heartbeatEvents$ = interval(SubscriptionEventStream.HEARTBEAT_INTERVAL_MS,).pipe(
            map(
                (): SseHeartbeatEvent => ({
                    kind: 'HEARTBEAT',
                }),
            ),
        );

        return merge(activationEvents$, cancellationEvents$, heartbeatEvents$);
    }

    private activationsForUser(userId: number,): Observable<SubscriptionActivatedEvent> {
        return this.subscriptionActivated$.pipe(
            filter((event) => event.userId === userId),
        );
    }

    private cancellationsForUser(userId: number,): Observable<SubscriptionCanceledEvent> {
        return this.subscriptionCanceled$.pipe(
            filter((event) => event.userId === userId),
        );
    }
}