import 'dotenv/config';

const {
    PAYMENT_CLIENT_ID,
    PAYMENT_CLIENT_SECRET,
    PAYMENT_BASE_URL,
} = process.env;

const PRODUCT_ID = 'PROD-7LJ37321XX115634M';
const REQUEST_TIMEOUT_MS = 10000;

async function main() {
    if (
        !PAYMENT_CLIENT_ID ||
        !PAYMENT_CLIENT_SECRET ||
        !PAYMENT_BASE_URL
    ) {
        throw new Error(
            'Falta la configuración del proveedor de pagos en .env.',
        );
    }

    if (PAYMENT_BASE_URL !== 'https://api-m.sandbox.paypal.com') {
        throw new Error(
            'Este script está destinado exclusivamente a PayPal Sandbox.',
        );
    }

    // 1. Obtener el access token OAuth.
    const credentials = Buffer.from(
        `${PAYMENT_CLIENT_ID}:${PAYMENT_CLIENT_SECRET}`,
    ).toString('base64');

    const tokenResponse = await fetch(
        `${PAYMENT_BASE_URL}/v1/oauth2/token`,
        {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            redirect: 'error',
        },
    );

    if (!tokenResponse.ok) {
        throw new Error(
            `No se pudo obtener el access token. HTTP ${tokenResponse.status}.`,
        );
    }

    const tokenResult = await tokenResponse.json();

    if (
        typeof tokenResult?.access_token !== 'string' ||
        !tokenResult.access_token
    ) {
        throw new Error(
            'El proveedor de pagos devolvió un access token inválido.',
        );
    }

    // 2. Crear el plan mensual de BiblioLink Pro.
    const planResponse = await fetch(
        `${PAYMENT_BASE_URL}/v1/billing/plans`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tokenResult.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Prefer: 'return=representation',
                'PayPal-Request-Id': 'bibliolink-pro-monthly-usd-5-v1',
            },
            body: JSON.stringify({
                product_id: PRODUCT_ID,
                name: 'BiblioLink Pro Mensual',
                description: 'Acceso mensual a BiblioLink Pro.',
                billing_cycles: [
                    {
                        frequency: {
                            interval_unit: 'MONTH',
                            interval_count: 1,
                        },
                        tenure_type: 'REGULAR',
                        sequence: 1,
                        total_cycles: 0,
                        pricing_scheme: {
                            fixed_price: {
                                currency_code: 'USD',
                                value: '5.00',
                            },
                        },
                    },
                ],
                payment_preferences: {
                    auto_bill_outstanding: true,
                },
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            redirect: 'error',
        },
    );

    if (!planResponse.ok) {
        throw new Error(
            `No se pudo crear el plan. HTTP ${planResponse.status}.`,
        );
    }

    const planResult = await planResponse.json();

    if (
        typeof planResult?.id !== 'string' ||
        !planResult.id
    ) {
        throw new Error(
            'El proveedor de pagos no devolvió un Plan ID válido.',
        );
    }

    console.log('Plan creado correctamente.');
    console.log(`Plan ID: ${planResult.id}`);
    console.log(`Estado: ${planResult.status ?? 'No informado'}`);
}

main().catch((error) => {
    console.error(
        error instanceof Error
            ? error.message
            : 'Error inesperado al crear el plan.',
    );

    process.exitCode = 1;
});