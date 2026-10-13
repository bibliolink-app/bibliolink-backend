import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { SeedModule } from './seed/seed.module';
import { SeedService } from './seed/seed.service';

@Module({ imports: [AppModule, SeedModule] })
class SeedApplicationModule {}

// Inicia la aplicación solo para ejecutar el seed de datos iniciales.
async function bootstrap(): Promise<void> {
    // Carga los servicios necesarios sin levantar el servidor web.
    const app = await NestFactory.createApplicationContext(SeedApplicationModule);

    try {
        const seedService = app.get(SeedService);
        await seedService.run();
    } finally {
        await app.close();
    }
}

void bootstrap();
