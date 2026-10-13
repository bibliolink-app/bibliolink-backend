import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseIntPipe, Patch, Post, UseGuards, } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ImportBookDto } from '../books/dto/import-book.dto';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { FavoritesListResponseDto } from './dto/favorites-list-response.dto';
import { ReadingStateResponseDto } from './dto/reading-state-response.dto';
import { UpdateReadingProgressDto } from './dto/update-reading-progress.dto';
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

    // Progreso de lectura del usuario sobre una obra favorita.
    @Get('books/:bookId/progress')
    async findReadingState(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Param('bookId', ParseIntPipe) bookId: number,
    ): Promise<ReadingStateResponseDto> {
        const readingState = await this.favoritesService.findReadingState(
            currentUser.userId,
            bookId,
        );

        if (!readingState) {
            throw new NotFoundException('El libro no está en tus favoritos.');
        }

        return readingState;
    }

    // Guarda el progreso de lectura de una obra favorita.
    @Patch('books/:bookId/progress')
    updateReadingProgress(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Param('bookId', ParseIntPipe) bookId: number,
        @Body() updateReadingProgressDto: UpdateReadingProgressDto,
    ): Promise<ReadingStateResponseDto> {
        return this.favoritesService.updateReadingProgress(
            currentUser.userId,
            bookId,
            updateReadingProgressDto.progressPercent,
            updateReadingProgressDto.readingLocation ?? null,
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
