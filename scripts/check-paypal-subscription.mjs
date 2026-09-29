import 'dotenv/config';

const {
    PAYMENT_CLIENT_ID,
    PAYMENT_CLIENT_SECRET,
    PAYMENT_BASE_URL,
} = process.env;

const SUBSCRIPTION_ID = 'I-2SRT7SSHW061';

async function main() {
    if (
        !PAYMENT_CLIENT_ID ||
        !PAYMENT_CLIENT_SECRET ||
        !PAYMENT_BASE_URL
    ) {
        throw new Error(
            'Falta la configuración del proveedor de pagos.',
        );
    }

    const credentials = Buffer.from(
        `${PAYMENT_CLIENT_ID}:${PAYMENT_CLIENT_SECRET}`,
    ).toString('base64');

    const tokenResponse = await fetch(
        `${PAYMENT_BASE_URL}/v1/oauth2/token`,
        {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type':
                    'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
            }),
        },
    );

    if (!tokenResponse.ok) {
        throw new Error(
            `No se pudo obtener el token. HTTP ${tokenResponse.status}`,
        );
    }

    const { access_token } = await tokenResponse.json();

    const subscriptionResponse = await fetch(
        `${PAYMENT_BASE_URL}/v1/billing/subscriptions/${encodeURIComponent(SUBSCRIPTION_ID)}`,
        {
            headers: {
                Authorization: `Bearer ${access_token}`,
                Accept: 'application/json',
            },
        },
    );

    if (!subscriptionResponse.ok) {
        throw new Error(
            `No se pudo consultar la suscripción. HTTP ${subscriptionResponse.status}`,
        );
    }

    const subscription = await subscriptionResponse.json();

    console.log('Subscription ID:', subscription.id);
    console.log('Status:', subscription.status);
    console.log('Plan ID:', subscription.plan_id);
    console.log(
        'Status updated at:',
        subscription.status_update_time ?? 'No informado',
    );
}

main().catch((error) => {
    console.error(
        error instanceof Error
            ? error.message
            : 'Error inesperado.',
    );

    process.exitCode = 1;
});