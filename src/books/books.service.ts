import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { In, Repository } from 'typeorm';

import { CatalogsService } from '../catalogs/catalogs.service';
import { SearchCatalogDto } from '../catalogs/dto/search-catalog.dto';
import { BookProviderCode } from '../catalogs/enums/book-provider-code.enum';
import type { ExternalBook } from '../catalogs/interfaces/external-book.interface';
import { isMySqlUniqueViolation } from '../common/databases/is-mysql-unique-violation';
import { resolveLanguageName } from './data/language-names';
import { BookDetailResponseDto } from './dto/book-detail-response.dto';
import { BookLanguageResponseDto } from './dto/book-language-response.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { ImportBookDto } from './dto/import-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookAuthor } from './entities/book-author.entity';
import { BookLanguage } from './entities/book-language.entity';
import { Book } from './entities/book.entity';
import { Language } from './entities/language.entity';
import type { FailedImportSummary, ImportedBookSummary, ImportSearchResult, } from './interfaces/import-result.interface';

// Resultado interno de guardar una obra externa en `books`.
interface UpsertResult {
    bookId: number;
    status: 'created' | 'updated';
}

@Injectable()
export class BooksService {
    constructor(
        @InjectPinoLogger(BooksService.name)
        private readonly logger: PinoLogger,

        @InjectRepository(Book)
        private readonly booksRepository: Repository<Book>,

        @InjectRepository(BookAuthor)
        private readonly bookAuthorsRepository: Repository<BookAuthor>,

        @InjectRepository(BookLanguage)
        private readonly bookLanguagesRepository: Repository<BookLanguage>,

        // `CatalogsService` resuelve el `provider_id` de cada proveedor y es
        // la puerta de entrada a las obras externas que aquí se persisten.
        private readonly catalogsService: CatalogsService,
    ) { }

    create(createBookDto: CreateBookDto) {
        this.logger.debug({ operation: 'create' }, 'Book scaffold method completed without persistence');
        return 'This action adds a new book';
    }

    update(id: number, updateBookDto: UpdateBookDto) {
        this.logger.debug({ bookId: id, operation: 'update' }, 'Book scaffold method completed without persistence');
        return `This action updates a #${id} book`;
    }

    remove(id: number) {
        this.logger.debug({ bookId: id, operation: 'remove' }, 'Book scaffold method completed without persistence');
        return `This action removes a #${id} book`;
    }

    // Lista las obras ya guardadas localmente, con sus autores e idiomas.
    async findAll(): Promise<BookDetailResponseDto[]> {
        this.logger.debug({ operation: 'findAll' }, 'Listing books');

        const books = await this.booksRepository
            .createQueryBuilder('book')
            .leftJoinAndSelect('book.provider', 'provider')
            .orderBy('book.title', 'ASC')
            .getMany();

        if (books.length === 0) {
            return [];
        }

        const bookIds = books.map((book) => book.bookId);

        // Se cargan autores e idiomas en dos consultas por lote en vez de
        // una por obra, para no repetir el patrón N+1 al listar todo el catálogo.
        const [authorsByBook, languagesByBook] = await Promise.all([
            this.loadAuthorsByBookIds(bookIds),
            this.loadLanguagesByBookIds(bookIds),
        ]);

        return books.map((book) =>
            this.toDetailDto(
                book,
                authorsByBook.get(book.bookId) ?? [],
                languagesByBook.get(book.bookId) ?? [],
            ),
        );
    }

    // Recupera una obra guardada localmente por su identificador interno.
    async findOne(bookId: number): Promise<BookDetailResponseDto> {
        this.logger.debug({ bookId, operation: 'findOne' }, 'Looking up book');

        const book = await this.booksRepository
            .createQueryBuilder('book')
            .leftJoinAndSelect('book.provider', 'provider')
            .where('book.bookId = :bookId', { bookId })
            .getOne();

        if (!book) {
            throw new NotFoundException('El libro no existe.');
        }

        const [authorsByBook, languagesByBook] = await Promise.all([
            this.loadAuthorsByBookIds([bookId]),
            this.loadLanguagesByBookIds([bookId]),
        ]);

        return this.toDetailDto(
            book,
            authorsByBook.get(bookId) ?? [],
            languagesByBook.get(bookId) ?? [],
        );
    }

    // Trae una obra puntual de un proveedor externo y la guarda en `books`.
    async importByReference(
        importBookDto: ImportBookDto,
    ): Promise<BookDetailResponseDto> {
        this.logger.debug(
            { providerCode: importBookDto.providerCode, operation: 'importByReference' },
            'Importing book from provider',
        );

        const externalBook = await this.catalogsService.findExternalBook(
            importBookDto.providerCode,
            importBookDto.externalReference,
        );

        const { bookId, status } = await this.upsertFromExternalBook(externalBook);

        this.logger.info(
            { bookId, providerCode: externalBook.providerCode, status },
            'Book imported successfully',
        );

        return this.findOne(bookId);
    }

    // Ejecuta una búsqueda en `catalogs` y guarda cada obra que devuelva.
    // Es la forma de poblar `books` con lo que ofrecen los proveedores sin
    // depender de que un usuario favorite algo primero: así el contenido
    // sigue disponible aunque la API externa quede caída más tarde.
    async importFromSearch(
        searchCatalogDto: SearchCatalogDto,
    ): Promise<ImportSearchResult> {
        this.logger.debug(
            { operation: 'importFromSearch' },
            'Importing books from catalog search',
        );

        const searchResult = await this.catalogsService.search(searchCatalogDto);

        const imported: ImportedBookSummary[] = [];
        const failed: FailedImportSummary[] = [];

        for (const page of searchResult.results) {
            for (const externalBook of page.items) {
                try {
                    const { bookId, status } =
                        await this.upsertFromExternalBook(externalBook);

                    imported.push({
                        providerCode: externalBook.providerCode,
                        externalReference: externalBook.externalReference,
                        title: externalBook.title,
                        bookId,
                        status,
                    });
                } catch (error: unknown) {
                    // Una obra que falle no debe descartar a las demás de la página.
                    this.logger.error(
                        {
                            err: error,
                            providerCode: externalBook.providerCode,
                            externalReference: externalBook.externalReference,
                        },
                        'Failed to import a book from the catalog search',
                    );

                    failed.push({
                        providerCode: externalBook.providerCode,
                        externalReference: externalBook.externalReference,
                        title: externalBook.title,
                        reason: 'No se pudo guardar la obra. Revise los registros del servidor.',
                    });
                }
            }
        }

        this.logger.info(
            {
                imported: imported.length,
                failed: failed.length,
                unavailableProviders: searchResult.unavailableProviders,
            },
            'Catalog search import completed',
        );

        return {
            query: searchResult.query,
            page: searchResult.page,
            pageSize: searchResult.pageSize,
            imported,
            failed,
            unavailableProviders: searchResult.unavailableProviders,
        };
    }

    // Inserta o actualiza una obra externa en `books`, `book_authors` y
    // `book_languages` dentro de una única transacción: las tres tablas
    // deben quedar consistentes o ninguna debe cambiar.
    private async upsertFromExternalBook(
        externalBook: ExternalBook,
    ): Promise<UpsertResult> {
        const providerId = await this.catalogsService.findProviderIdByCode(
            externalBook.providerCode,
        );

        return this.booksRepository.manager.transaction(async (manager) => {
            const bookRepository = manager.getRepository(Book);
            const bookAuthorRepository = manager.getRepository(BookAuthor);
            const bookLanguageRepository = manager.getRepository(BookLanguage);
            const languageRepository = manager.getRepository(Language);

            let book = await bookRepository.findOne({
                where: {
                    providerId,
                    externalReference: externalBook.externalReference,
                },
            });

            let status: 'created' | 'updated';

            if (book) {
                book.title = externalBook.title;
                book.description = externalBook.description;
                book.coverUrl = externalBook.coverUrl;
                book.contentReference = externalBook.contentReference;

                await bookRepository.save(book);
                status = 'updated';
            } else {
                book = bookRepository.create({
                    providerId,
                    externalReference: externalBook.externalReference,
                    title: externalBook.title,
                    description: externalBook.description,
                    coverUrl: externalBook.coverUrl,
                    contentReference: externalBook.contentReference,
                });

                try {
                    await bookRepository.save(book);
                } catch (error: unknown) {
                    if (!isMySqlUniqueViolation(error)) {
                        throw error;
                    }

                    // Dos importaciones concurrentes intentaron crear la misma
                    // obra; se recupera la que ganó la carrera y se continúa.
                    book = await bookRepository.findOneOrFail({
                        where: {
                            providerId,
                            externalReference: externalBook.externalReference,
                        },
                    });
                }

                status = 'created';
            }

            await this.replaceAuthors(
                bookAuthorRepository,
                book.bookId,
                externalBook.authors,
            );

            await this.replaceLanguages(
                languageRepository,
                bookLanguageRepository,
                book.bookId,
                externalBook.languageCodes,
            );

            return { bookId: book.bookId, status };
        });
    }

    // Reemplaza la lista completa de autores de una obra. Es más simple que
    // calcular un diff y el volumen de autores por obra siempre es bajo.
    private async replaceAuthors(
        bookAuthorRepository: Repository<BookAuthor>,
        bookId: number,
        authors: readonly string[],
    ): Promise<void> {
        await bookAuthorRepository.delete({ bookId });

        if (authors.length === 0) {
            return;
        }

        const rows = authors.map((authorName, index) =>
            bookAuthorRepository.create({
                bookId,
                // `authorOrder` es 1-based para que el primer autor tenga
                // orden 1 en vez de 0.
                authorOrder: index + 1,
                authorName,
            }),
        );

        await bookAuthorRepository.save(rows);
    }

    // Reemplaza la lista completa de idiomas de una obra, creando primero
    // en `languages` los códigos que todavía no existan.
    private async replaceLanguages(
        languageRepository: Repository<Language>,
        bookLanguageRepository: Repository<BookLanguage>,
        bookId: number,
        languageCodes: readonly string[],
    ): Promise<void> {
        for (const languageCode of languageCodes) {
            await this.ensureLanguageExists(languageRepository, languageCode);
        }

        await bookLanguageRepository.delete({ bookId });

        if (languageCodes.length === 0) {
            return;
        }

        const rows = languageCodes.map((languageCode) =>
            bookLanguageRepository.create({ bookId, languageCode }),
        );

        await bookLanguageRepository.save(rows);
    }

    // Crea el idioma en `languages` si todavía no existe. Se apoya en la
    // misma detección de duplicados que usa el resto del proyecto en vez de
    // un `upsert` nativo, para no depender de un comportamiento específico
    // del driver de base de datos.
    private async ensureLanguageExists(
        languageRepository: Repository<Language>,
        languageCode: string,
    ): Promise<void> {
        const existingLanguage = await languageRepository.findOne({
            where: { languageCode },
        });

        if (existingLanguage) {
            return;
        }

        try {
            await languageRepository.save(
                languageRepository.create({
                    languageCode,
                    name: resolveLanguageName(languageCode),
                }),
            );
        } catch (error: unknown) {
            if (!isMySqlUniqueViolation(error)) {
                throw error;
            }

            // Otra importación concurrente ya creó este idioma; no hay más que hacer.
        }
    }

    // Trae, en una sola consulta, los autores de varias obras a la vez.
    private async loadAuthorsByBookIds(
        bookIds: number[],
    ): Promise<Map<number, string[]>> {
        const authors = await this.bookAuthorsRepository.find({
            where: { bookId: In(bookIds) },
            order: { authorOrder: 'ASC' },
        });

        const authorsByBook = new Map<number, string[]>();

        for (const author of authors) {
            const authorsForBook = authorsByBook.get(author.bookId) ?? [];
            authorsForBook.push(author.authorName);
            authorsByBook.set(author.bookId, authorsForBook);
        }

        return authorsByBook;
    }

    // Trae, en una sola consulta, los idiomas de varias obras a la vez.
    private async loadLanguagesByBookIds(
        bookIds: number[],
    ): Promise<Map<number, BookLanguageResponseDto[]>> {
        const bookLanguages = await this.bookLanguagesRepository.find({
            where: { bookId: In(bookIds) },
            relations: { language: true },
        });

        const languagesByBook = new Map<number, BookLanguageResponseDto[]>();

        for (const bookLanguage of bookLanguages) {
            const languagesForBook = languagesByBook.get(bookLanguage.bookId) ?? [];
            languagesForBook.push({
                languageCode: bookLanguage.languageCode,
                name: bookLanguage.language.name,
            });
            languagesByBook.set(bookLanguage.bookId, languagesForBook);
        }

        return languagesByBook;
    }

    // Traduce una fila de `books` (más sus autores e idiomas ya resueltos)
    // al formato de respuesta público.
    private toDetailDto(
        book: Book,
        authors: string[],
        languages: BookLanguageResponseDto[],
    ): BookDetailResponseDto {
        return {
            bookId: book.bookId,
            providerId: book.providerId,
            providerCode: book.provider.code as BookProviderCode,
            externalReference: book.externalReference,
            title: book.title,
            description: book.description,
            coverUrl: book.coverUrl,
            contentReference: book.contentReference,
            authors,
            languages,
            createdAt: book.createdAt,
            updatedAt: book.updatedAt,
        };
    }
}
