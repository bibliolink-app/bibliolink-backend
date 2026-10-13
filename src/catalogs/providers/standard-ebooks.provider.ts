import { Injectable } from '@nestjs/common';

import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH, BOOK_TITLE_MAX_LENGTH, } from '../constants/catalogs.constants';
import { BookContentFormat } from '../enums/book-content-format.enum';
import { BookProviderCode } from '../enums/book-provider-code.enum';
import { CatalogHttpService } from '../http/catalog-http.service';
import type { BookCatalogProvider } from '../interfaces/book-catalog-provider.interface';
import type { CatalogSearchCriteria, ExternalBook, ExternalBookPage, } from '../interfaces/external-book.interface';
import { NO_BOOK_CONTENT, toBookContent, type BookContent, } from '../utils/book-content.util';
import { mapStandardEbooksCategories, type StandardEbooksSubject, } from '../mappings/standard-ebooks-categories.mapping';
import { normalizeAuthorNames, normalizeLanguageCodes, toArray, toNullableText, toNullableUrl, truncate, } from '../utils/catalog-text.util';

// Standard Ebooks no publica una API REST propia, pero su catálogo OPDS
// devuelve JSON (OPDS 2.0) cuando se solicita con la cabecera adecuada.
const STANDARD_EBOOKS_FEED_URL = 'https://standardebooks.org/feeds/opds/all';
const STANDARD_EBOOKS_ACCEPT = 'application/opds+json';

// Prefijo común de los identificadores del catálogo. Se recorta para guardar
// una referencia corta y estable del tipo `bram-stoker/dracula`.
const STANDARD_EBOOKS_IDENTIFIER_PREFIX = 'https://standardebooks.org/ebooks/';

// Relación OPDS que marca la imagen de portada a tamaño completo.
const OPDS_IMAGE_REL = 'http://opds-spec.org/image';

// Orden de preferencia del formato que se ofrece como contenido, con el
// formato que corresponde a cada tipo de enlace del feed OPDS. El XHTML es la
// obra completa en una sola página (`/text/single-page`).
const CONTENT_TYPE_PREFERENCES: readonly { contentType: string; format: BookContentFormat }[] = [
    { contentType: 'application/epub+zip', format: BookContentFormat.EPUB },
    { contentType: 'application/xhtml+xml', format: BookContentFormat.HTML },
];

interface OpdsLink {
    href?: string;
    rel?: string | string[];
    type?: string;
    title?: string;
}

interface OpdsAuthor {
    name?: string;
}

interface OpdsPublication {
    metadata?: {
        identifier?: string;
        title?: string;
        description?: string;
        language?: string | string[];
        author?: OpdsAuthor | OpdsAuthor[];
        // Temas de la obra, cada uno con el vocabulario al que pertenece.
        belongsTo?: {
            subjects?: StandardEbooksSubject | StandardEbooksSubject[];
        };
    };
    images?: OpdsLink[];
    links?: OpdsLink[];
}

interface OpdsFeed {
    publications?: OpdsPublication[];
}

@Injectable()
export class StandardEbooksProvider implements BookCatalogProvider {
    readonly code = BookProviderCode.STANDARD_EBOOKS;

    constructor(
        private readonly catalogHttpService: CatalogHttpService,
    ) {}

    // Busca ediciones cuidadas de obras de dominio público.
    async search(
        criteria: CatalogSearchCriteria,
    ): Promise<ExternalBookPage> {
        const items = await this.fetchPublications(
            criteria.query,
            criteria.page,
            criteria.pageSize,
        );

        // El feed no informa el total de coincidencias ni un enlace a la
        // página siguiente, así que se deduce a partir de la página completa.
        return {
            providerCode: this.code,
            items,
            page: criteria.page,
            pageSize: criteria.pageSize,
            totalItems: null,
            hasNextPage: items.length === criteria.pageSize,
        };
    }

    // Recupera una obra a partir de su referencia (`autor/titulo`).
    async findByExternalReference(
        externalReference: string,
    ): Promise<ExternalBook | null> {
        // Solo se aceptan referencias con la forma `autor/titulo`.
        if (!/^[a-z0-9-]+\/[a-z0-9-]+(\/[a-z0-9-]+)*$/i.test(externalReference)) {
            return null;
        }

        // El catálogo no expone un endpoint por obra, por lo que se busca con
        // las palabras de la referencia y se confirma la coincidencia exacta.
        const searchTerms = externalReference.replace(/[/-]/g, ' ');

        const items = await this.fetchPublications(searchTerms, 1, 20);

        return items.find(
            (item) => item.externalReference === externalReference,
        ) ?? null;
    }

    // Consulta el feed OPDS y devuelve las obras ya normalizadas.
    private async fetchPublications(
        query: string,
        page: number,
        pageSize: number,
    ): Promise<ExternalBook[]> {
        const url = new URL(STANDARD_EBOOKS_FEED_URL);

        if (query.length > 0) {
            url.searchParams.set('query', query);
        }

        url.searchParams.set('per-page', String(pageSize));
        url.searchParams.set('page', String(page));

        const feed = await this.catalogHttpService.getJson<OpdsFeed>(url, {
            providerCode: this.code,
            accept: STANDARD_EBOOKS_ACCEPT,
        });

        return (feed.publications ?? [])
            .map((publication) => this.mapPublication(publication))
            .filter((book): book is ExternalBook => book !== null);
    }

    // Traduce una publicación OPDS al formato uniforme del catálogo.
    private mapPublication(
        publication: OpdsPublication,
    ): ExternalBook | null {
        const metadata = publication.metadata ?? {};
        const title = toNullableText(metadata.title, BOOK_TITLE_MAX_LENGTH);
        const externalReference = this.toExternalReference(metadata.identifier);

        if (externalReference === null || title === null) {
            return null;
        }

        return {
            providerCode: this.code,
            externalReference,
            title,
            description: toNullableText(metadata.description),
            coverUrl: this.resolveCoverUrl(publication.images ?? []),
            ...this.resolveContent(publication.links ?? []),
            authors: normalizeAuthorNames(
                toArray(metadata.author).map((author) => author.name),
            ),
            languageCodes: normalizeLanguageCodes(metadata.language),
            // Se usan solo los temas del vocabulario propio de Standard
            // Ebooks; los LCSH que vienen junto a ellos son demasiado específicos.
            categoryCodes: mapStandardEbooksCategories(
                toArray(metadata.belongsTo?.subjects),
            ),
        };
    }

    // Convierte el identificador del feed en una referencia corta.
    private toExternalReference(identifier: unknown): string | null {
        if (typeof identifier !== 'string') {
            return null;
        }

        const slug = identifier
            .trim()
            .replace(STANDARD_EBOOKS_IDENTIFIER_PREFIX, '')
            .replace(/^\/+|\/+$/g, '');

        if (slug.length === 0) {
            return null;
        }

        return truncate(slug, BOOK_EXTERNAL_REFERENCE_MAX_LENGTH);
    }

    // Toma la portada a tamaño completo y, si falta, cualquier imagen ofrecida.
    private resolveCoverUrl(images: OpdsLink[]): string | null {
        const cover = images.find(
            (image) => toArray(image.rel).includes(OPDS_IMAGE_REL),
        );

        return toNullableUrl((cover ?? images[0])?.href);
    }

    // Elige el formato descargable más conveniente para leer la obra y fija
    // su formato a partir del tipo con que el feed OPDS declara el enlace.
    private resolveContent(links: OpdsLink[]): BookContent {
        for (const { contentType, format } of CONTENT_TYPE_PREFERENCES) {
            const candidate = links.find((link) => link.type === contentType);
            const content = toBookContent(candidate?.href, format);

            if (content.contentReference !== null) {
                return content;
            }
        }

        // Como último recurso se enlaza la ficha pública de la obra: es una
        // página sobre el libro, no el libro en sí.
        const alternate = links.find(
            (link) => toArray(link.rel).includes('alternate'),
        );

        return alternate
            ? toBookContent(alternate.href, BookContentFormat.EXTERNAL_PAGE)
            : NO_BOOK_CONTENT;
    }
}
