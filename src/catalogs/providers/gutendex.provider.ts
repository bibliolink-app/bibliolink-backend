import { Injectable } from '@nestjs/common';

import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH, BOOK_TITLE_MAX_LENGTH, } from '../constants/catalogs.constants';
import { BookContentFormat } from '../enums/book-content-format.enum';
import { BookProviderCode } from '../enums/book-provider-code.enum';
import { CatalogHttpService } from '../http/catalog-http.service';
import type { BookCatalogProvider } from '../interfaces/book-catalog-provider.interface';
import type { CatalogSearchCriteria, ExternalBook, ExternalBookPage, } from '../interfaces/external-book.interface';
import { NO_BOOK_CONTENT, toBookContent, type BookContent, } from '../utils/book-content.util';
import { normalizeAuthorNames, normalizeCategoryNames, normalizeLanguageCodes, toNullableText, toNullableUrl, truncate, } from '../utils/catalog-text.util';

// Gutendex es la API JSON que publica el catálogo de Project Gutenberg.
const GUTENDEX_BOOKS_URL = 'https://gutendex.com/books/';

// Gutendex entrega un tamaño de página fijo de 32 obras y no admite
// configurarlo, por lo que `pageSize` se ignora en este proveedor.
const GUTENDEX_PAGE_SIZE = 32;

// Gutendex se hospeda en un servicio que se suspende cuando no recibe
// tráfico: la primera consulta tras un rato inactivo puede tardar más de
// medio minuto, mientras que las siguientes responden en milisegundos.
const GUTENDEX_REQUEST_TIMEOUT_MS = 20000;

// Orden de preferencia del formato que se guarda como contenido de la obra,
// con el formato que corresponde a cada tipo MIME que declara Gutendex.
const CONTENT_MIME_PREFERENCES: readonly { mimeType: string; format: BookContentFormat }[] = [
    { mimeType: 'text/html', format: BookContentFormat.HTML },
    { mimeType: 'application/epub+zip', format: BookContentFormat.EPUB },
    { mimeType: 'text/plain; charset=utf-8', format: BookContentFormat.TEXT },
    { mimeType: 'text/plain', format: BookContentFormat.TEXT },
];

// Formato preferido para la portada.
const COVER_MIME_TYPE = 'image/jpeg';

interface GutendexPerson {
    name?: string;
}

interface GutendexBook {
    id?: number;
    title?: string;
    authors?: GutendexPerson[];
    summaries?: string[];
    languages?: string[];
    // Temas de la obra y colecciones editoriales en las que Gutendex la agrupa.
    subjects?: string[];
    bookshelves?: string[];
    formats?: Record<string, string>;
}

interface GutendexResponse {
    count?: number;
    next?: string | null;
    results?: GutendexBook[];
}

@Injectable()
export class GutendexProvider implements BookCatalogProvider {
    readonly code = BookProviderCode.GUTENDEX;

    constructor(
        private readonly catalogHttpService: CatalogHttpService,
    ) {}

    // Busca obras de dominio público por título y autor.
    async search(
        criteria: CatalogSearchCriteria,
    ): Promise<ExternalBookPage> {
        const url = new URL(GUTENDEX_BOOKS_URL);

        if (criteria.query.length > 0) {
            url.searchParams.set('search', criteria.query);
        }

        if (criteria.language) {
            url.searchParams.set('languages', criteria.language);
        }

        url.searchParams.set('page', String(criteria.page));

        const response =
            await this.catalogHttpService.getJson<GutendexResponse>(url, {
                providerCode: this.code,
                accept: 'application/json',
                timeoutMs: GUTENDEX_REQUEST_TIMEOUT_MS,
            });

        const items = (response.results ?? [])
            .map((book) => this.mapBook(book))
            .filter((book): book is ExternalBook => book !== null);

        return {
            providerCode: this.code,
            items,
            page: criteria.page,
            pageSize: GUTENDEX_PAGE_SIZE,
            totalItems: typeof response.count === 'number' ? response.count : null,
            hasNextPage: Boolean(response.next),
        };
    }

    // Recupera una obra por su identificador numérico de Project Gutenberg.
    async findByExternalReference(
        externalReference: string,
    ): Promise<ExternalBook | null> {
        // El identificador de Gutendex siempre es numérico.
        if (!/^\d+$/.test(externalReference)) {
            return null;
        }

        // Gutendex responde con una lista vacía en lugar de un 404 cuando el
        // identificador no existe, por eso se consulta con el filtro `ids`.
        const url = new URL(GUTENDEX_BOOKS_URL);
        url.searchParams.set('ids', externalReference);

        const response =
            await this.catalogHttpService.getJson<GutendexResponse>(url, {
                providerCode: this.code,
                accept: 'application/json',
                timeoutMs: GUTENDEX_REQUEST_TIMEOUT_MS,
            });

        const book = response.results?.[0];

        return book ? this.mapBook(book) : null;
    }

    // Traduce una obra de Gutendex al formato uniforme del catálogo.
    private mapBook(book: GutendexBook): ExternalBook | null {
        const title = toNullableText(book.title, BOOK_TITLE_MAX_LENGTH);

        // Sin identificador o sin título la obra no puede guardarse.
        if (typeof book.id !== 'number' || title === null) {
            return null;
        }

        const formats = book.formats ?? {};

        return {
            providerCode: this.code,
            externalReference: truncate(
                String(book.id),
                BOOK_EXTERNAL_REFERENCE_MAX_LENGTH,
            ),
            title,
            // Gutendex publica una o varias sinopsis; se conserva la primera.
            description: toNullableText(book.summaries?.[0]),
            coverUrl: toNullableUrl(formats[COVER_MIME_TYPE]),
            ...this.resolveContent(formats),
            authors: normalizeAuthorNames(
                (book.authors ?? []).map((author) => author.name),
            ),
            languageCodes: normalizeLanguageCodes(book.languages),
            // Gutendex separa los temas (`subjects`) de las colecciones
            // editoriales (`bookshelves`); ambos sirven para clasificar.
            categoryNames: normalizeCategoryNames([
                ...(book.subjects ?? []),
                ...(book.bookshelves ?? []),
            ]),
        };
    }

    // Elige el formato de lectura más conveniente entre los disponibles y
    // fija su formato a partir del tipo MIME con que Gutendex lo publica.
    private resolveContent(
        formats: Record<string, string>,
    ): BookContent {
        for (const { mimeType, format } of CONTENT_MIME_PREFERENCES) {
            const content = toBookContent(formats[mimeType], format);

            if (content.contentReference !== null) {
                return content;
            }
        }

        // Si ninguno de los formatos preferidos está presente se toma el
        // primer enlace de texto que ofrezca el proveedor.
        const fallback = Object.entries(formats).find(
            ([mimeType]) => mimeType.startsWith('text/'),
        );

        if (!fallback) {
            return NO_BOOK_CONTENT;
        }

        const [mimeType, url] = fallback;

        return toBookContent(url, this.formatFromMimeType(mimeType));
    }

    // Traduce un tipo MIME de texto (por ejemplo `text/plain; charset=us-ascii`)
    // al formato del catálogo. Lo que no sea HTML ni texto plano no se procesa.
    private formatFromMimeType(mimeType: string): BookContentFormat {
        const baseType = mimeType.split(';')[0]!.trim().toLowerCase();

        if (baseType === 'text/html') {
            return BookContentFormat.HTML;
        }

        if (baseType === 'text/plain') {
            return BookContentFormat.TEXT;
        }

        return BookContentFormat.UNSUPPORTED;
    }
}
