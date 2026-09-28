import type { ExternalBookPage } from './external-book.interface';

// Resultado de una búsqueda que puede abarcar varios proveedores a la vez.
export interface CatalogSearchResult {
    query: string;

    page: number;

    pageSize: number;

    // Una página de resultados por cada proveedor que respondió.
    results: ExternalBookPage[];

    // Proveedores consultados que no respondieron. La búsqueda no falla por
    // ellos: se informan para que el frontend pueda avisar al usuario.
    unavailableProviders: string[];
}
