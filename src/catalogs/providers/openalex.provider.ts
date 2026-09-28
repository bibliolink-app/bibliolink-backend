import { Injectable } from '@nestjs/common';

import { envs } from '../../config/envs';
import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH, BOOK_TITLE_MAX_LENGTH, } from '../constants/catalogs.constants';
import { BookProviderCode } from '../enums/book-provider-code.enum';
import { CatalogHttpService } from '../http/catalog-http.service';
import type { BookCatalogProvider } from '../interfaces/book-catalog-provider.interface';
import type { CatalogSearchCriteria, ExternalBook, ExternalBookPage, } from '../interfaces/external-book.interface';
import { normalizeAuthorNames, normalizeLanguageCodes, toNullableText, toNullableUrl, truncate, } from '../utils/catalog-text.util';

// OpenAlex indexa artículos, libros y otros trabajos académicos.
const OPENALEX_WORKS_URL = 'https://api.openalex.org/works';

// Prefijo de los identificadores de OpenAlex (por ejemplo W2101234009).
const OPENALEX_IDENTIFIER_PREFIX = 'https://openalex.org/';

// OpenAlex atiende con mayor prioridad a quien se identifica con un correo.
const OPENALEX_MAILTO = envs.catalog.contactEmail;

// Palabras máximas que se reconstruyen del resumen invertido.
const OPENALEX_ABSTRACT_MAX_WORDS = 800;

interface OpenAlexLocation {
    pdf_url?: string | null;
    landing_page_url?: string | null;
}

interface OpenAlexAuthorship {
    author?: {
        display_name?: string;
    };
}

interface OpenAlexWork {
    id?: string;
    doi?: string | null;
    title?: string | null;
    display_name?: string | null;
    language?: string | null;
    authorships?: OpenAlexAuthorship[];
    abstract_inverted_index?: Record<string, number[]> | null;
    open_access?: {
        oa_url?: string | null;
    };
    primary_location?: OpenAlexLocation | null;
    best_oa_location?: OpenAlexLocation | null;
}

interface OpenAlexResponse {
    meta?: {
        count?: number;
        page?: number;
        per_page?: number;
    };
    results?: OpenAlexWork[];
}

@Injectable()
export class OpenAlexProvider implements BookCatalogProvider {
    readonly code = BookProviderCode.OPENALEX;

    constructor(
        private readonly catalogHttpService: CatalogHttpService,
    ) {}

    // Busca trabajos académicos por texto libre.
    async search(
        criteria: CatalogSearchCriteria,
    ): Promise<ExternalBookPage> {
        const url = this.buildUrl(OPENALEX_WORKS_URL);

        if (criteria.query.length > 0) {
            url.searchParams.set('search', criteria.query);
        }

        if (criteria.language) {
            url.searchParams.set('filter', `language:${criteria.language}`);
        }

        url.searchParams.set('per_page', String(criteria.pageSize));
        url.searchParams.set('page', String(criteria.page));

        const response =
            await this.catalogHttpService.getJson<OpenAlexResponse>(url, {
                providerCode: this.code,
                accept: 'application/json',
            });

        const items = (response.results ?? [])
            .map((work) => this.mapWork(work))
            .filter((work): work is ExternalBook => work !== null);

        const totalItems =
            typeof response.meta?.count === 'number'
                ? response.meta.count
                : null;

        return {
            providerCode: this.code,
            items,
            page: criteria.page,
            pageSize: criteria.pageSize,
            totalItems,
            hasNextPage:
                totalItems === null
                    ? items.length === criteria.pageSize
                    : criteria.page * criteria.pageSize < totalItems,
        };
    }

    // Recupera un trabajo por su identificador de OpenAlex.
    async findByExternalReference(
        externalReference: string,
    ): Promise<ExternalBook | null> {
        // Los identificadores de trabajos son una W seguida de dígitos.
        if (!/^W\d+$/i.test(externalReference)) {
            return null;
        }

        const url = this.buildUrl(
            `${OPENALEX_WORKS_URL}/${externalReference.toUpperCase()}`,
        );

        const work =
            await this.catalogHttpService.getJson<OpenAlexWork>(url, {
                providerCode: this.code,
                accept: 'application/json',
            });

        return this.mapWork(work);
    }

    // Prepara la URL agregando siempre el correo de contacto.
    private buildUrl(baseUrl: string): URL {
        const url = new URL(baseUrl);
        url.searchParams.set('mailto', OPENALEX_MAILTO);

        return url;
    }

    // Traduce un trabajo de OpenAlex al formato uniforme del catálogo.
    private mapWork(work: OpenAlexWork): ExternalBook | null {
        const externalReference = this.toExternalReference(work.id);
        const title = toNullableText(
            work.display_name ?? work.title,
            BOOK_TITLE_MAX_LENGTH,
        );

        if (externalReference === null || title === null) {
            return null;
        }

        return {
            providerCode: this.code,
            externalReference,
            title,
            description: this.rebuildAbstract(work.abstract_inverted_index),
            // OpenAlex es un índice de metadatos y no distribuye portadas.
            coverUrl: null,
            contentReference: this.resolveContentReference(work),
            authors: normalizeAuthorNames(
                (work.authorships ?? []).map(
                    (authorship) => authorship.author?.display_name,
                ),
            ),
            languageCodes: normalizeLanguageCodes(work.language),
        };
    }

    // Quita el prefijo de la URL y deja solo el identificador.
    private toExternalReference(id: unknown): string | null {
        if (typeof id !== 'string') {
            return null;
        }

        const reference = id.trim().replace(OPENALEX_IDENTIFIER_PREFIX, '');

        if (reference.length === 0) {
            return null;
        }

        return truncate(reference, BOOK_EXTERNAL_REFERENCE_MAX_LENGTH);
    }

    // OpenAlex no entrega el resumen como texto, sino como un índice
    // invertido donde cada palabra apunta a las posiciones que ocupa.
    // Aquí se reconstruye el párrafo original a partir de esas posiciones.
    private rebuildAbstract(
        invertedIndex: Record<string, number[]> | null | undefined,
    ): string | null {
        if (!invertedIndex) {
            return null;
        }

        const words: string[] = [];

        for (const [word, positions] of Object.entries(invertedIndex)) {
            for (const position of positions) {
                if (
                    Number.isInteger(position) &&
                    position >= 0 &&
                    position < OPENALEX_ABSTRACT_MAX_WORDS
                ) {
                    words[position] = word;
                }
            }
        }

        // Los huecos aparecen cuando el índice viene incompleto; se descartan.
        return toNullableText(
            words.filter((word) => word !== undefined).join(' '),
        );
    }

    // Prefiere el acceso abierto y, si no existe, la página del trabajo.
    private resolveContentReference(work: OpenAlexWork): string | null {
        const candidates = [
            work.best_oa_location?.pdf_url,
            work.best_oa_location?.landing_page_url,
            work.open_access?.oa_url,
            work.primary_location?.pdf_url,
            work.primary_location?.landing_page_url,
            work.doi,
        ];

        for (const candidate of candidates) {
            const url = toNullableUrl(candidate);

            if (url !== null) {
                return url;
            }
        }

        return null;
    }
}
