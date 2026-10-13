import { createHmac, timingSafeEqual, } from 'node:crypto';

const REFERENCE_VERSION = 'v1';

const CHECKOUT_REFERENCE_PATTERN =
    /^v1\.([1-9]\d*)\.([A-Za-z0-9_-]{43})$/;

export function createSubscriptionCheckoutReference(
    subscriptionId: number,
    userId: number,
    secret: string,
): string {
    if (
        !Number.isSafeInteger(subscriptionId) ||
        subscriptionId <= 0 ||
        !Number.isSafeInteger(userId) ||
        userId <= 0
    ) {
        throw new Error(
            'Los identificadores de la suscripción son inválidos.',
        );
    }

    const payload =
        `${REFERENCE_VERSION}:${subscriptionId}:${userId}`;

    const signature = createHmac(
        'sha256',
        secret,
    )
        .update(payload)
        .digest('base64url');

    return [
        REFERENCE_VERSION,
        subscriptionId,
        signature,
    ].join('.');
}

export function getSubscriptionIdFromCheckoutReference(
    reference: string,
): number | null {
    const match =
        CHECKOUT_REFERENCE_PATTERN.exec(reference);

    if (!match) {
        return null;
    }

    const subscriptionId = Number(match[1]);

    if (
        !Number.isSafeInteger(subscriptionId) ||
        subscriptionId <= 0
    ) {
        return null;
    }

    return subscriptionId;
}

export function verifySubscriptionCheckoutReference(
    reference: string,
    subscriptionId: number,
    userId: number,
    secret: string,
): boolean {
    const referenceSubscriptionId =
        getSubscriptionIdFromCheckoutReference(reference);

    if (
        referenceSubscriptionId === null ||
        referenceSubscriptionId !== subscriptionId
    ) {
        return false;
    }

    const expectedReference =
        createSubscriptionCheckoutReference(
            subscriptionId,
            userId,
            secret,
        );

    const received = Buffer.from(reference);
    const expected = Buffer.from(expectedReference);

    if (received.length !== expected.length) {
        return false;
    }

    return timingSafeEqual(received, expected);
}