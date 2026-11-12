import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards, } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ImportBookDto } from '../books/dto/import-book.dto';
import type { Language } from '../i18n/i18n.constants';
import { localizedError } from '../i18n/localized-error';
import { localizedParseIntPipe } from '../i18n/localized-pipes';
import { RequestLanguage } from '../i18n/request-language.decorator';
import { translate } from '../i18n/translate';
import { AddedFavoriteResponseDto } from './dto/added-favorite-response.dto';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { FavoritesListResponseDto } from './dto/favorites-list-response.dto';
import { ReadingStateResponseDto } from './dto/reading-state-response.dto';
import { RemovedFavoriteResponseDto } from './dto/removed-favorite-response.dto';
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
    async addFavorite(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Body() createFavoriteDto: CreateFavoriteDto,
        @RequestLanguage() language: Language,
    ): Promise<AddedFavoriteResponseDto> {
        const favorite = await this.favoritesService.addFavorite(
            currentUser.userId,
            createFavoriteDto.bookId,
        );

        return this.withAddedMessage(favorite, language);
    }

    // Agrega una obra desde un resultado de `GET /catalogs/search`, por su
    // proveedor y su referencia externa. La importa a `books` si hace falta.
    @Post('external')
    async addFavoriteByReference(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Body() importBookDto: ImportBookDto,
        @RequestLanguage() language: Language,
    ): Promise<AddedFavoriteResponseDto> {
        const favorite = await this.favoritesService.addFavoriteByReference(
            currentUser.userId,
            importBookDto,
        );

        return this.withAddedMessage(favorite, language);
    }

    // Progreso de lectura del usuario sobre una obra favorita.
    @Get('books/:bookId/progress')
    async findReadingState(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Param('bookId', localizedParseIntPipe('VALIDATION_BOOK_ID_INTEGER')) bookId: number,
    ): Promise<ReadingStateResponseDto> {
        const readingState = await this.favoritesService.findReadingState(
            currentUser.userId,
            bookId,
        );

        if (!readingState) {
            throw new NotFoundException(localizedError('FAVORITE_NOT_FOUND'));
        }

        return readingState;
    }

    // Guarda el progreso de lectura de una obra favorita.
    @Patch('books/:bookId/progress')
    updateReadingProgress(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Param('bookId', localizedParseIntPipe('VALIDATION_BOOK_ID_INTEGER')) bookId: number,
        @Body() updateReadingProgressDto: UpdateReadingProgressDto,
    ): Promise<ReadingStateResponseDto> {
        return this.favoritesService.updateReadingProgress(
            currentUser.userId,
            bookId,
            updateReadingProgressDto.progressPercent,
            updateReadingProgressDto.readingLocation ?? null,
        );
    }

    // Quita una obra de favoritos. Responde `200` con un mensaje de
    // confirmación (antes era `204` sin cuerpo).
    @Delete('books/:bookId')
    async removeFavorite(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Param('bookId', localizedParseIntPipe('VALIDATION_BOOK_ID_INTEGER')) bookId: number,
        @RequestLanguage() language: Language,
    ): Promise<RemovedFavoriteResponseDto> {
        const { title } = await this.favoritesService.removeFavorite(currentUser.userId, bookId);

        return {
            bookId,
            message: translate('FAVORITE_REMOVED', language, { title }),
        };
    }

    private withAddedMessage(
        favorite: FavoriteResponseDto,
        language: Language,
    ): AddedFavoriteResponseDto {
        return {
            ...favorite,
            message: translate('FAVORITE_ADDED', language, { title: favorite.book.title }),
        };
    }
}
