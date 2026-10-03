import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UseGuards, } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ImportBookDto } from '../books/dto/import-book.dto';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { FavoritesListResponseDto } from './dto/favorites-list-response.dto';
import { FavoritesService } from './favorites.service';

// Todas las rutas operan sobre los favoritos del usuario autenticado: el
// `userId` sale siempre del token, nunca del cuerpo ni de la URL.
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
    constructor(
        private readonly favoritesService: FavoritesService,
    ) { }

    // Favoritos del usuario, con su plan y los espacios que le quedan.
    @Get()
    findAll(
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<FavoritesListResponseDto> {
        return this.favoritesService.findAllForUser(currentUser.userId);
    }

    // Agrega una obra que ya está en `books`, por su `bookId`.
    @Post()
    addFavorite(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Body() createFavoriteDto: CreateFavoriteDto,
    ): Promise<FavoriteResponseDto> {
        return this.favoritesService.addFavorite(
            currentUser.userId,
            createFavoriteDto.bookId,
        );
    }

    // Agrega una obra desde un resultado de `GET /catalogs/search`, por su
    // proveedor y su referencia externa. La importa a `books` si hace falta.
    @Post('external')
    addFavoriteByReference(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Body() importBookDto: ImportBookDto,
    ): Promise<FavoriteResponseDto> {
        return this.favoritesService.addFavoriteByReference(
            currentUser.userId,
            importBookDto,
        );
    }

    // Quita una obra de favoritos.
    @Delete('books/:bookId')
    @HttpCode(HttpStatus.NO_CONTENT)
    removeFavorite(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Param('bookId', ParseIntPipe) bookId: number,
    ): Promise<void> {
        return this.favoritesService.removeFavorite(currentUser.userId, bookId);
    }
}
