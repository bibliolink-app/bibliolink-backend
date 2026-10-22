import { join } from 'node:path';

import { DataSource } from 'typeorm';

import { databaseConnectionOptions } from '../config/database.config';

// Conexión que usa el CLI de TypeORM para ejecutar migraciones
// (`pnpm migration:run`). La aplicación no la importa: Nest arma su propia
// conexión en `AppModule` con los mismos datos.
//
// El CLI trabaja sobre el código compilado en `dist/`, por eso las rutas
// apuntan a archivos `.js` relativos a esta carpeta.
const AppDataSource = new DataSource({
    ...databaseConnectionOptions,
    entities: [join(__dirname, '..', '**', '*.entity.js')],
    migrations: [join(__dirname, 'migrations', '*.js')],
});

export default AppDataSource;
