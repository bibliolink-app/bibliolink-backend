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
