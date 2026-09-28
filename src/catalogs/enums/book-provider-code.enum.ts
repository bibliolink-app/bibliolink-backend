// Códigos con los que se identifica a cada proveedor externo de contenido.
// El valor debe coincidir exactamente con la columna `code` de `book_providers`.
export enum BookProviderCode {
    GUTENDEX = 'gutendex',
    STANDARD_EBOOKS = 'standard-ebooks',
    ARXIV = 'arxiv',
    OPENALEX = 'openalex',
}

// Lista de códigos válidos, útil para validar parámetros de entrada.
export const BOOK_PROVIDER_CODES: readonly string[] =
    Object.values(BookProviderCode);
