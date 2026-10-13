import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { BooksModule } from '../books/books.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Favorite } from './entities/favorite.entity';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Favorite]),
        AuthModule,
        // `JwtAuthGuard` necesita las opciones de Passport en este módulo,
        // igual que en `subscriptions` y `analytics`.
        PassportModule.register({ session: false }),
        // Decide si el usuario es Premium y, por lo tanto, su límite.
        SubscriptionsModule,
        // Aporta los datos de las obras y la importación desde catálogos.
        BooksModule,
    ],
    controllers: [FavoritesController],
    providers: [FavoritesService],
    // Permite que otros módulos (por ejemplo, `reading`) lean y guarden el
    // progreso de lectura sin duplicar esta lógica.
    exports: [FavoritesService],
})
export class FavoritesModule { }
