import 'dotenv/config';

const { PAYMENT_CLIENT_ID, PAYMENT_CLIENT_SECRET, PAYMENT_BASE_URL } =
    process.env;

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

    // 2. Crear el producto BiblioLink Pro.
    const productResponse = await fetch(
        `${PAYMENT_BASE_URL}/v1/catalogs/products`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tokenResult.access_token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Prefer: 'return=representation',
                'PayPal-Request-Id': 'bibliolink-pro-product-v1',
            },
            body: JSON.stringify({
                name: 'BiblioLink Pro',
                description:
                    'Suscripción premium a la plataforma de lectura BiblioLink.',
                type: 'SERVICE',
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            redirect: 'error',
        },
    );

    if (!productResponse.ok) {
        throw new Error(
            `No se pudo crear el producto. HTTP ${productResponse.status}.`,
        );
    }

    const productResult = await productResponse.json();

    if (
        typeof productResult?.id !== 'string' ||
        !productResult.id
    ) {
        throw new Error(
            'El proveedor de pagos no devolvió un identificador de producto válido.',
        );
    }

    console.log('Producto creado correctamente.');
    console.log(`Product ID: ${productResult.id}`);
}

main().catch((error) => {
    console.error(
        error instanceof Error
            ? error.message
            : 'Error inesperado al crear el producto.',
    );

    process.exitCode = 1;
});