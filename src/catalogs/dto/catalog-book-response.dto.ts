import { BookProviderCode } from '../enums/book-provider-code.enum';

// Obra tal como la ven los clientes de `catalogs`. Omite a propósito
// `contentReference` y `contentFormat`: el enlace al contenido es interno y
// solo `reading` decide si un usuario puede leerlo y cómo entregárselo.
export class CatalogBookResponseDto {
    providerCode!: BookProviderCode;

    externalReference!: string;

    title!: string;

    description!: string | null;

    coverUrl!: string | null;

    authors!: string[];

    languageCodes!: string[];
}

// Página de resultados de un proveedor, sin datos internos.
export class CatalogBookPageResponseDto {
    providerCode!: BookProviderCode;

    items!: CatalogBookResponseDto[];

    page!: number;

    pageSize!: number;

    totalItems!: number | null;

    hasNextPage!: boolean;
}

// Respuesta de `GET /catalogs/search`.
export class CatalogSearchResponseDto {
    query!: string;

    page!: number;

    pageSize!: number;

    results!: CatalogBookPageResponseDto[];

    unavailableProviders!: string[];
}
