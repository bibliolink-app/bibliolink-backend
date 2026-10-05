import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdsModule } from '../ads/ads.module';
import { AuthModule } from '../auth/auth.module';
import { BooksModule } from '../books/books.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ReadingAccess } from './entities/reading-access.entity';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([ReadingAccess]),
        AuthModule,
        PassportModule.register({ session: false }),
        BooksModule,
        FavoritesModule,
        SubscriptionsModule,
        AdsModule,
    ],
    controllers: [ReadingController],
    providers: [ReadingService],
})
export class ReadingModule { }