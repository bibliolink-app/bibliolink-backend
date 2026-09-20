import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SeedService } from './seed.service';

import { SecurityModule } from '../common/security/security.module';
// Reúne el servicio del seed y la herramienta que protege la contraseña.
@Module({
    imports: [
        ConfigModule,
        SecurityModule,
    ],
    providers: [
        SeedService,
    ],
    exports: [
        SeedService,
    ],
})
export class SeedModule { }
