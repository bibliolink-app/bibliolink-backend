import { BookProviderCode } from '../enums/book-provider-code.enum';
import type { CatalogSearchCriteria, ExternalBook, ExternalBookPage, } from './external-book.interface';

// Contrato que implementa cada API externa de contenido.
// Todo proveedor nuevo solo necesita cumplir esta interfaz y registrarse
// en `CatalogsModule` para quedar disponible en las búsquedas.
export interface BookCatalogProvider {
    // Código con el que se registra el proveedor en la base de datos.
    readonly code: BookProviderCode;

    // Busca obras en el proveedor y las devuelve ya normalizadas.
    search(criteria: CatalogSearchCriteria): Promise<ExternalBookPage>;

    // Recupera una obra puntual a partir de su referencia externa.
    // Devuelve `null` cuando el proveedor no la encuentra.
    findByExternalReference(
        externalReference: string,
    ): Promise<ExternalBook | null>;
}
