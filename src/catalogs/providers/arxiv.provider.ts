import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { setTimeout as delay } from 'node:timers/promises';

import { BOOK_EXTERNAL_REFERENCE_MAX_LENGTH, BOOK_TITLE_MAX_LENGTH, } from '../constants/catalogs.constants';
import { BookContentFormat } from '../enums/book-content-format.enum';
import { BookProviderCode } from '../enums/book-provider-code.enum';
import { CatalogHttpService } from '../http/catalog-http.service';
import type { BookCatalogProvider } from '../interfaces/book-catalog-provider.interface';
import type { CatalogSearchCriteria, ExternalBook, ExternalBookPage, } from '../interfaces/external-book.interface';
import { toBookContent, type BookContent, } from '../utils/book-content.util';
import { mapArxivCategories } from '../mappings/arxiv-categories.mapping';
import { normalizeAuthorNames, toArray, toNullableText, toNullableUrl, truncate, } from '../utils/catalog-text.util';

// arXiv publica su API como un feed Atom, no como JSON.
const ARXIV_QUERY_URL = 'https://export.arxiv.org/api/query';

// La documentación de arXiv pide dejar al menos tres segundos entre llamadas
// consecutivas, así que las solicitudes se encolan y se espacian.
const ARXIV_MIN_REQUEST_INTERVAL_MS = 3000;

// Prefijo de los identificadores devueltos en el campo id de cada entrada.
const ARXIV_ABSTRACT_PATH = '/abs/';

// arXiv no informa el idioma de cada artículo; su catálogo se publica en inglés.
const ARXIV_DEFAULT_LANGUAGE = 'en';

// Identificadores admitidos: los nuevos por fecha (2306.04338) y los
// antiguos por categoría (cs/0701001), con o sin número de versión.
const ARXIV_REFERENCE_PATTERN =
    /^([a-z-]+(\.[a-z]{2})?\/)?\d{4,7}(\.\d{4,5})?(v\d+)?$/i;

interface AtomLink {
    '@_href'?: string;
    '@_rel'?: string;
    '@_type'?: string;
    '@_title'?: string;
}

interface AtomAuthor {
    name?: string;
}

// Categoría de la taxonomía de arXiv (`<category term="cs.LG"/>`).
interface AtomCategory {
    '@_term'?: string;
}

interface AtomEntry {
    id?: string;
    title?: string;
    summary?: string;
    author?: AtomAuthor | AtomAuthor[];
    link?: AtomLink | AtomLink[];
    category?: AtomCategory | AtomCategory[];
    // `arxiv:primary_category`; el prefijo se quita al leer el XML.
    primary_category?: AtomCategory;
}

interface AtomFeed {
    feed?: {
        entry?: AtomEntry | AtomEntry[];
        totalResults?: string | number;
    };
}

@Injectable()
export class ArxivProvider implements BookCatalogProvider {
    readonly code = BookProviderCode.ARXIV;

    // removeNSPrefix deja los campos de arXiv y OpenSearch con nombres
    // simples; parseTagValue se desactiva para que todo llegue como texto.
    private readonly xmlParser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true,
        parseTagValue: false,
        trimValues: true,
    });

    // Cola que garantiza el intervalo mínimo entre llamadas a arXiv.
    private requestQueue: Promise<unknown> = Promise.resolve();
    private lastRequestAt = 0;

    constructor(
        private readonly catalogHttpService: CatalogHttpService,
    ) {}

    // Busca artículos científicos por texto libre.
    async search(
        criteria: CatalogSearchCriteria,
    ): Promise<ExternalBookPage> {
        // arXiv exige un criterio de búsqueda: no admite listar todo el archivo.
        if (criteria.query.length === 0) {
            return {
                providerCode: this.code,
                items: [],
                page: criteria.page,
                pageSize: criteria.pageSize,
                totalItems: 0,
                hasNextPage: false,
            };
        }

        const url = new URL(ARXIV_QUERY_URL);

        // Las comillas convierten el texto en una frase exacta; se retiran las
        // que venga a traer el usuario para no romper la consulta.
        url.searchParams.set(
            'search_query',
            'all:"' + criteria.query.replace(/"/g, ' ') + '"',
        );
        url.searchParams.set('start', String((criteria.page - 1) * criteria.pageSize));
        url.searchParams.set('max_results', String(criteria.pageSize));
        url.searchParams.set('sortBy', 'relevance');
        url.searchParams.set('sortOrder', 'descending');

        const feed = await this.fetchFeed(url);

        const items = toArray(feed.feed?.entry)
            .map((entry) => this.mapEntry(entry))
            .filter((entry): entry is ExternalBook => entry !== null);

        const totalItems = Number(feed.feed?.totalResults);
        const resolvedTotal = Number.isFinite(totalItems) ? totalItems : null;

        return {
            providerCode: this.code,
            items,
            page: criteria.page,
            pageSize: criteria.pageSize,
            totalItems: resolvedTotal,
            hasNextPage:
                resolvedTotal === null
                    ? items.length === criteria.pageSize
                    : criteria.page * criteria.pageSize < resolvedTotal,
        };
    }

    // Recupera un artículo por su identificador de arXiv.
    async findByExternalReference(
        externalReference: string,
    ): Promise<ExternalBook | null> {
        if (!ARXIV_REFERENCE_PATTERN.test(externalReference)) {
            return null;
        }

        const url = new URL(ARXIV_QUERY_URL);
        url.searchParams.set('id_list', externalReference);
        url.searchParams.set('max_results', '1');

        const feed = await this.fetchFeed(url);
        const entry = toArray(feed.feed?.entry)[0];

        return entry ? this.mapEntry(entry) : null;
    }

    // Descarga el feed Atom respetando el intervalo pedido por arXiv.
    private fetchFeed(url: URL): Promise<AtomFeed> {
        const request = this.requestQueue.then(async () => {
            const elapsed = Date.now() - this.lastRequestAt;

            if (elapsed < ARXIV_MIN_REQUEST_INTERVAL_MS) {
                await delay(ARXIV_MIN_REQUEST_INTERVAL_MS - elapsed);
            }

            try {
                const xml = await this.catalogHttpService.getText(url, {
                    providerCode: this.code,
                    accept: 'application/atom+xml',
                });

                return this.xmlParser.parse(xml) as AtomFeed;
            } finally {
                this.lastRequestAt = Date.now();
            }
        });

        // La cola debe seguir avanzando aunque una consulta falle.
        this.requestQueue = request.catch(() => undefined);

        return request;
    }

    // Traduce una entrada del feed al formato uniforme del catálogo.
    private mapEntry(entry: AtomEntry): ExternalBook | null {
        const externalReference = this.toExternalReference(entry.id);
        const title = toNullableText(entry.title, BOOK_TITLE_MAX_LENGTH);

        if (externalReference === null || title === null) {
            return null;
        }

        return {
            providerCode: this.code,
            externalReference,
            title,
            description: toNullableText(entry.summary),
            // arXiv no publica portadas para sus artículos.
            coverUrl: null,
            ...this.resolveContent(
                toArray(entry.link),
                externalReference,
            ),
            authors: normalizeAuthorNames(
                toArray(entry.author).map((author) => author.name),
            ),
            languageCodes: [ARXIV_DEFAULT_LANGUAGE],
            categoryCodes: mapArxivCategories(
                entry.primary_category?.['@_term'],
                toArray(entry.category)
                    .map((category) => category['@_term'])
                    .filter((term): term is string => typeof term === 'string'),
            ),
        };
    }

    // Extrae el identificador del artículo y descarta el número de versión
    // para que las consultas repetidas no dupliquen la misma obra.
    private toExternalReference(id: unknown): string | null {
        if (typeof id !== 'string') {
            return null;
        }

        const separatorIndex = id.indexOf(ARXIV_ABSTRACT_PATH);

        // Las respuestas de error de arXiv no apuntan a ningún artículo.
        if (separatorIndex < 0) {
            return null;
        }

        const reference = id
            .slice(separatorIndex + ARXIV_ABSTRACT_PATH.length)
            .replace(/v\d+$/, '');

        if (reference.length === 0) {
            return null;
        }

        return truncate(reference, BOOK_EXTERNAL_REFERENCE_MAX_LENGTH);
    }

    // Prefiere el PDF del artículo y, si no aparece, su página de resumen.
    // El formato sale de cómo arXiv declara el enlace (`title="pdf"` o
    // `type="application/pdf"`); la página de resumen es una ficha web, no
    // el artículo, así que se marca como página externa.
    private resolveContent(
        links: AtomLink[],
        externalReference: string,
    ): BookContent {
        const pdfLink = links.find(
            (link) =>
                link['@_title'] === 'pdf' ||
                link['@_type'] === 'application/pdf',
        );

        const pdfContent = toBookContent(pdfLink?.['@_href'], BookContentFormat.PDF);

        if (pdfContent.contentReference !== null) {
            return pdfContent;
        }

        const alternate = links.find((link) => link['@_rel'] === 'alternate');

        return toBookContent(
            toNullableUrl(alternate?.['@_href']) ??
            'https://arxiv.org' + ARXIV_ABSTRACT_PATH + externalReference,
            BookContentFormat.EXTERNAL_PAGE,
        );
    }
}
