import * as mysql2 from 'mysql2';
import type { DataSourceOptions } from 'typeorm';

import { envs } from './envs';

// Opciones de conexión compartidas por la aplicación (`AppModule`) y por el
// CLI de migraciones (`src/database/data-source.ts`).
export const databaseConnectionOptions = {
    type: envs.database.type,
    host: envs.database.host,
    port: envs.database.port,
    username: envs.database.user,
    password: envs.database.password,
    database: envs.database.name,

    // TypeORM carga el driver con `require(nombre)`, una ruta que el rastreo de
    // archivos de Vercel no puede seguir: sin esta línea `mysql2` queda fuera
    // de la función y la app no arranca (`DriverPackageNotInstalledError`).
    // Pasarlo explícitamente lo convierte en un import estático.
    driver: mysql2,

    synchronize: false,
    timezone: 'Z',
    dateStrings: false,
    connectTimeout: 10_000,

    // Sin `rejectUnauthorized: false`: se valida el certificado del servidor.
    ssl: envs.database.ssl ? { rejectUnauthorized: true } : undefined,

    extra: {
        connectionLimit: envs.database.poolSize,
    },
} satisfies DataSourceOptions;

// Reintentos de `TypeOrmModule` al arrancar. Por omisión TypeORM hace 9 cada
// 3 s, lo que cuelga cada arranque en frío casi dos minutos si la base no
// responde.
export const databaseRetryOptions = {
    retryAttempts: envs.database.connectRetries,
    retryDelay: 1_000,
};
