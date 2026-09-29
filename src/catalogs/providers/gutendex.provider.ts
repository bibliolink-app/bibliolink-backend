import { Injectable } from '@nestjs/common';

import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH, BOOK_TITLE_MAX_LENGTH, } from '../constants/catalogs.constants';
import { BookProviderCode } from '../enums/book-provider-code.enum';
import { CatalogHttpService } from '../http/catalog-http.service';
import type { BookCatalogProvider } from '../interfaces/book-catalog-provider.interface';
import type { CatalogSearchCriteria, ExternalBook, ExternalBookPage, } from '../interfaces/external-book.interface';
import { normalizeAuthorNames, normalizeLanguageCodes, toNullableText, toNullableUrl, truncate, } from '../utils/catalog-text.util';

// Gutendex es la API JSON que publica el catálogo de Project Gutenberg.
const GUTENDEX_BOOKS_URL = 'https://gutendex.com/books/';

// Gutendex entrega un tamaño de página fijo de 32 obras y no admite
// configurarlo, por lo que `pageSize` se ignora en este proveedor.
const GUTENDEX_PAGE_SIZE = 32;

// Gutendex se hospeda en un servicio que se suspende cuando no recibe
// tráfico: la primera consulta tras un rato inactivo puede tardar más de
// medio minuto, mientras que las siguientes responden en milisegundos.
const GUTENDEX_REQUEST_TIMEOUT_MS = 20000;

// Orden de preferencia del formato que se guarda como contenido de la obra.
const CONTENT_MIME_PREFERENCES = [
    'text/html',
    'application/epub+zip',
    'text/plain; charset=utf-8',
    'text/plain',
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
            contentReference: this.resolveContentReference(formats),
            authors: normalizeAuthorNames(
                (book.authors ?? []).map((author) => author.name),
            ),
            languageCodes: normalizeLanguageCodes(book.languages),
        };
    }

    // Elige el formato de lectura más conveniente entre los disponibles.
    private resolveContentReference(
        formats: Record<string, string>,
    ): string | null {
        for (const mimeType of CONTENT_MIME_PREFERENCES) {
            const candidate = toNullableUrl(formats[mimeType]);

            if (candidate !== null) {
                return candidate;
            }
        }

        // Si ninguno de los formatos preferidos está presente se toma el
        // primer enlace de texto que ofrezca el proveedor.
        const fallback = Object.entries(formats).find(
            ([mimeType]) => mimeType.startsWith('text/'),
        );

        return fallback ? toNullableUrl(fallback[1]) : null;
    }
}
