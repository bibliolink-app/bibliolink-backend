import type { BookProviderCode } from '../../catalogs/enums/book-provider-code.enum';

// Registra el resultado de importar una obra puntual desde un proveedor.
export interface ImportedBookSummary {
    providerCode: BookProviderCode;

    externalReference: string;

    title: string;

    bookId: number;

    // Indica si la obra ya existía en `books` (y se actualizó) o si se
    // insertó por primera vez.
    status: 'created' | 'updated';
}

// Registra una obra que no pudo guardarse, junto con el motivo.
export interface FailedImportSummary {
    providerCode: BookProviderCode;

    externalReference: string;

    title: string;

    reason: string;
}

// Resultado de importar todas las obras que arroja una búsqueda en el
// catálogo. Una obra individual que falle no interrumpe a las demás.
export interface ImportSearchResult {
    query: string;

    page: number;

    pageSize: number;

    imported: ImportedBookSummary[];

    failed: FailedImportSummary[];

    // Proveedores que no respondieron a la búsqueda en `catalogs` y que,
    // por lo tanto, no aportaron obras a importar.
    unavailableProviders: string[];
}

// Resultado de una carga masiva: recorre varias páginas (de uno o de todos
// los proveedores) hasta agotarlas o hasta llegar a `maxPages`.
export interface BulkImportResult {
    query: string;

    pageSize: number;

    maxPages: number;

    // Páginas efectivamente consultadas antes de detenerse.
    pagesFetched: number;

    imported: ImportedBookSummary[];

    failed: FailedImportSummary[];

    // Proveedores que dejaron de responder durante la carga. Se detiene ahí
    // mismo en vez de seguir pidiendo páginas a una API que ya mostró estar caída.
    unavailableProviders: string[];

    // `true` cuando se llegó a `maxPages` sin que el proveedor se quedara sin
    // resultados: hay más obras disponibles que no se llegaron a importar.
    truncated: boolean;
}
