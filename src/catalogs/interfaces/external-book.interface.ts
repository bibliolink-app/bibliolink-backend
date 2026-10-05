import { BookContentFormat } from '../enums/book-content-format.enum';
import { BookProviderCode } from '../enums/book-provider-code.enum';

// Representación uniforme de una obra devuelta por cualquier proveedor.
// Sus campos están alineados con las entidades `Book`, `BookAuthor` y
// `BookLanguage`, de modo que persistirla sea una traducción directa.
export interface ExternalBook {
    // Proveedor que entregó la obra; permite resolver el `provider_id`.
    providerCode: BookProviderCode;

    // Identificador de la obra dentro del proveedor. Junto al proveedor
    // forma la clave única `UQ_books_provider_external_reference`.
    externalReference: string;

    title: string;

    description: string | null;

    coverUrl: string | null;

    // Enlace al contenido legible o descargable de la obra. Es información
    // interna: los endpoints públicos no lo exponen.
    contentReference: string | null;

    // Formato del recurso de `contentReference`. Es `null` exactamente cuando
    // `contentReference` es `null`. También es interno.
    contentFormat: BookContentFormat | null;

    // Autores en el orden en que los publica el proveedor.
    authors: string[];

    // Códigos de idioma normalizados (por ejemplo `en`, `es`).
    languageCodes: string[];
}

// Página de resultados de un proveedor.
export interface ExternalBookPage {
    providerCode: BookProviderCode;

    items: ExternalBook[];

    page: number;

    // Tamaño de página aplicado por el proveedor. Puede diferir del
    // solicitado cuando la API externa impone el suyo.
    pageSize: number;

    // Total de coincidencias informado por el proveedor, o `null` si no lo publica.
    totalItems: number | null;

    hasNextPage: boolean;
}

// Criterios de búsqueda ya normalizados que recibe cada proveedor.
export interface CatalogSearchCriteria {
    // Texto libre a buscar. Puede venir vacío cuando el proveedor
    // admite listados sin filtro.
    query: string;

    // Código de idioma opcional para acotar los resultados.
    language?: string;

    // Número de página, empezando en 1.
    page: number;

    pageSize: number;
}
