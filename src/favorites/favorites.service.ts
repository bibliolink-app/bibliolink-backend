import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';

import { BooksService } from '../books/books.service';
import { BookDetailResponseDto } from '../books/dto/book-detail-response.dto';
import { ImportBookDto } from '../books/dto/import-book.dto';
import { Book } from '../books/entities/book.entity';
import { isMySqlUniqueViolation } from '../common/databases/is-mysql-unique-violation';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { User } from '../users/entities/user.entity';
import { FREE_FAVORITES_LIMIT, MAX_PROGRESS_PERCENT, MIN_PROGRESS_PERCENT, PREMIUM_FAVORITES_LIMIT, READING_LOCATION_MAX_LENGTH, } from './constants/favorites.constants';
import { FavoriteResponseDto } from './dto/favorite-response.dto';
import { FavoritesListResponseDto } from './dto/favorites-list-response.dto';
import { ReadingStateResponseDto } from './dto/reading-state-response.dto';
import { Favorite } from './entities/favorite.entity';
import { UserPlan } from './enums/user-plan.enum';

// Plan vigente del usuario y el límite de favoritos que le corresponde.
interface FavoritesQuota {
    plan: UserPlan;
    limit: number;
}

@Injectable()
export class FavoritesService {
    constructor(
        @InjectPinoLogger(FavoritesService.name)
        private readonly logger: PinoLogger,

        @InjectRepository(Favorite)
        private readonly favoritesRepository: Repository<Favorite>,

        // Determina si el usuario es Premium a partir de su suscripción.
        private readonly subscriptionsService: SubscriptionsService,

        // Aporta los datos completos de cada obra favorita.
        private readonly booksService: BooksService,
    ) { }

    // Lista los favoritos del usuario, del más reciente al más antiguo,
    // junto con su plan y cuántos espacios le quedan.
    async findAllForUser(userId: number): Promise<FavoritesListResponseDto> {
        this.logger.debug({ userId, operation: 'findAllForUser' }, 'Listing favorites');

        const [quota, favorites] = await Promise.all([
            this.resolveQuota(userId),
            this.favoritesRepository.find({
                where: { userId },
                order: { addedAt: 'DESC' },
            }),
        ]);

        const books = await this.booksService.findByIds(
            favorites.map((favorite) => favorite.bookId),
        );

        const booksById = new Map(books.map((book) => [book.bookId, book]));

        const items = favorites.flatMap((favorite) => {
            const book = booksById.get(favorite.bookId);

            // La FK con borrado en cascada impide que falte la obra; se
            // descarta igual por si se borró entre ambas consultas.
            return book ? [this.toResponseDto(favorite, book)] : [];
        });

        return {
            plan: quota.plan,
            limit: quota.limit,
            count: favorites.length,
            remaining: Math.max(0, quota.limit - favorites.length),
            items,
        };
    }

    // Agrega a favoritos una obra que ya está guardada en `books`.
    async addFavorite(
        userId: number,
        bookId: number,
    ): Promise<FavoriteResponseDto> {
        this.logger.debug({ userId, bookId, operation: 'addFavorite' }, 'Adding favorite');

        // El plan se resuelve antes de abrir la transacción para no retener
        // el bloqueo del usuario mientras se consulta su suscripción.
        const quota = await this.resolveQuota(userId);

        let favorite: Favorite;

        try {
            favorite = await this.favoritesRepository.manager.transaction(
                async (manager) => {
                    // Se bloquea la fila del usuario para serializar sus altas:
                    // dos solicitudes simultáneas no pueden pasar ambas el
                    // control del límite y dejarlo con un favorito de más.
                    const user = await manager
                        .getRepository(User)
                        .createQueryBuilder('user')
                        .setLock('pessimistic_write')
                        .where('user.userId = :userId', { userId })
                        .getOne();

                    if (!user) {
                        throw new NotFoundException('El usuario no existe.');
                    }

                    const bookExists = await manager
                        .getRepository(Book)
                        .exists({ where: { bookId } });

                    if (!bookExists) {
                        throw new NotFoundException('El libro no existe.');
                    }

                    const favoriteRepository = manager.getRepository(Favorite);

                    const alreadyFavorite = await favoriteRepository.exists({
                        where: { userId, bookId },
                    });

                    if (alreadyFavorite) {
                        throw new ConflictException(
                            'El libro ya está en tus favoritos.',
                        );
                    }

                    const favoritesCount = await favoriteRepository.count({
                        where: { userId },
                    });

                    // Con `>=` también se bloquea a quien dejó de ser Premium
                    // y conserva más favoritos que el límite gratuito: no se le
                    // borra ninguno, pero no puede agregar hasta bajar del límite.
                    if (favoritesCount >= quota.limit) {
                        this.logger.warn(
                            { userId, plan: quota.plan, limit: quota.limit, favoritesCount },
                            'Favorite rejected: plan limit reached',
                        );

                        throw new ForbiddenException(
                            this.buildLimitMessage(quota),
                        );
                    }

                    return favoriteRepository.save(
                        favoriteRepository.create({
                            userId,
                            bookId,
                            progressPercent: '0.00',
                            readingLocation: null,
                            addedAt: new Date(),
                            lastReadAt: null,
                        }),
                    );
                },
            );
        } catch (error: unknown) {
            // Respaldo de `UQ_favorites_user_book` por si la verificación
            // anterior no alcanzara a detectar el duplicado.
            if (isMySqlUniqueViolation(error)) {
                throw new ConflictException('El libro ya está en tus favoritos.');
            }

            throw error;
        }

        this.logger.info(
            { userId, bookId, favoriteId: favorite.favoriteId, plan: quota.plan },
            'Favorite added successfully',
        );

        const book = await this.booksService.findOne(bookId);

        return this.toResponseDto(favorite, book);
    }

    // Agrega a favoritos una obra a partir de su referencia en el proveedor,
    // tal como la devuelve `GET /catalogs/search`. Si la obra todavía no está
    // en `books` se importa primero; si ya está, se usa la copia local.
    async addFavoriteByReference(
        userId: number,
        importBookDto: ImportBookDto,
    ): Promise<FavoriteResponseDto> {
        const book = await this.booksService.findOrImportByReference(importBookDto);

        return this.addFavorite(userId, book.bookId);
    }

    // Quita una obra de los favoritos del usuario.
    async removeFavorite(userId: number, bookId: number): Promise<void> {
        this.logger.debug({ userId, bookId, operation: 'removeFavorite' }, 'Removing favorite');

        const result = await this.favoritesRepository.delete({ userId, bookId });

        if (!result.affected) {
            throw new NotFoundException('El libro no está en tus favoritos.');
        }

        this.logger.info({ userId, bookId }, 'Favorite removed successfully');
    }

    // Devuelve el progreso de lectura del usuario sobre una obra favorita, o
    // `null` si no la tiene en favoritos. Se busca por `userId` + `bookId`
    // porque la misma obra puede ser favorita de muchos usuarios y cada uno
    // tiene su propio progreso.
    async findReadingState(
        userId: number,
        bookId: number,
    ): Promise<ReadingStateResponseDto | null> {
        this.logger.debug({ userId, bookId, operation: 'findReadingState' }, 'Looking up reading state');

        const favorite = await this.favoritesRepository.findOne({
            select: {
                progressPercent: true,
                readingLocation: true,
                lastReadAt: true,
            },
            where: { userId, bookId },
        });

        if (!favorite) {
            return null;
        }

        return {
            // MySQL devuelve los DECIMAL como texto para no perder precisión.
            progressPercent: Number(favorite.progressPercent),
            readingLocation: favorite.readingLocation,
            lastReadAt: favorite.lastReadAt,
        };
    }

    // Guarda el progreso de lectura de una obra que el usuario ya tiene en
    // favoritos. `lastReadAt` siempre lo fija el backend, nunca el cliente,
    // para que no dependa del reloj del dispositivo.
    async updateReadingProgress(
        userId: number,
        bookId: number,
        progressPercent: number,
        readingLocation: string | null,
    ): Promise<ReadingStateResponseDto> {
        this.logger.debug({ userId, bookId, operation: 'updateReadingProgress' }, 'Updating reading progress');

        // Se valida aquí además de en el DTO porque otros módulos pueden
        // llamar a este método sin pasar por la capa HTTP.
        if (
            !Number.isFinite(progressPercent) ||
            progressPercent < MIN_PROGRESS_PERCENT ||
            progressPercent > MAX_PROGRESS_PERCENT
        ) {
            throw new BadRequestException(
                `El progreso debe estar entre ${MIN_PROGRESS_PERCENT} y ${MAX_PROGRESS_PERCENT}.`,
            );
        }

        if (
            readingLocation !== null &&
            readingLocation.length > READING_LOCATION_MAX_LENGTH
        ) {
            throw new BadRequestException(
                `La posición de lectura no puede superar los ${READING_LOCATION_MAX_LENGTH} caracteres.`,
            );
        }

        // La columna es DECIMAL(5,2): se redondea a dos decimales para que lo
        // que se responde coincida con lo que queda guardado.
        const roundedProgress = Math.round(progressPercent * 100) / 100;
        const lastReadAt = new Date();

        const result = await this.favoritesRepository.update(
            { userId, bookId },
            {
                progressPercent: roundedProgress.toFixed(2),
                readingLocation,
                lastReadAt,
            },
        );

        if (!result.affected) {
            throw new NotFoundException('El libro no está en tus favoritos.');
        }

        this.logger.info(
            { userId, bookId, progressPercent: roundedProgress },
            'Reading progress updated successfully',
        );

        return {
            progressPercent: roundedProgress,
            readingLocation,
            lastReadAt,
        };
    }

    // El límite depende de si el usuario tiene acceso Premium vigente.
    // Se calcula en cada operación en lugar de guardarse, para que una
    // suscripción que vence o se activa se refleje de inmediato.
    private async resolveQuota(userId: number): Promise<FavoritesQuota> {
        const isPremium = await this.subscriptionsService.hasPremiumAccess(userId);

        return isPremium
            ? { plan: UserPlan.PREMIUM, limit: PREMIUM_FAVORITES_LIMIT }
            : { plan: UserPlan.FREE, limit: FREE_FAVORITES_LIMIT };
    }

    private buildLimitMessage(quota: FavoritesQuota): string {
        if (quota.plan === UserPlan.PREMIUM) {
            return `Alcanzaste el límite de ${quota.limit} favoritos del plan Premium.`;
        }

        return (
            `Alcanzaste el límite de ${quota.limit} favoritos del plan gratuito. ` +
            `Hazte Premium para guardar hasta ${PREMIUM_FAVORITES_LIMIT}.`
        );
    }

    private toResponseDto(
        favorite: Favorite,
        book: BookDetailResponseDto,
    ): FavoriteResponseDto {
        return {
            favoriteId: favorite.favoriteId,
            bookId: favorite.bookId,
            // MySQL devuelve los DECIMAL como texto para no perder precisión.
            progressPercent: Number(favorite.progressPercent),
            readingLocation: favorite.readingLocation,
            addedAt: favorite.addedAt,
            lastReadAt: favorite.lastReadAt,
            book,
        };
    }
}
