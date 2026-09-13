import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Favorite } from "./favorite.entity.js";
import { FavoriteService } from "./favorite.service.js";
import { FavoriteController } from "./favorite.controller.js";

@Module({
    imports: [TypeOrmModule.forFeature([Favorite])],
    controllers: [FavoriteController],
    providers: [FavoriteService],
})

export class FavoritesModule {}