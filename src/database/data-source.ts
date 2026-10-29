import { join } from 'node:path';

import { DataSource } from 'typeorm';

import { envs } from '../config/envs';

// Conexión que usa el CLI de TypeORM para ejecutar migraciones
// (`pnpm migration:run`). La aplicación no la importa: Nest arma su propia
// conexión en `AppModule` con los mismos datos.
//
// El CLI trabaja sobre el código compilado en `dist/`, por eso las rutas
// apuntan a archivos `.js` relativos a esta carpeta.
const AppDataSource = new DataSource({
    type: envs.database.type,
    host: envs.database.host,
    port: envs.database.port,
    username: envs.database.user,
    password: envs.database.password,
    database: envs.database.name,
    synchronize: false,
    timezone: 'Z',
    dateStrings: false,
    entities: [join(__dirname, '..', '**', '*.entity.js')],
    migrations: [join(__dirname, 'migrations', '*.js')],
});

export default AppDataSource;
