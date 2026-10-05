import type { BookContentFormat } from '../../catalogs/enums/book-content-format.enum';

// Origen del contenido legible de una obra. Es un contrato interno entre
// `books` y `reading`: nunca debe devolverse tal cual por un endpoint, porque
// `contentReference` es la URL original del archivo.
export interface BookReadingSource {
    bookId: number;

    contentReference: string | null;

    // `null` si la obra no tiene contenido, o si se importó antes de que se
    // guardara el formato y todavía no se volvió a importar.
    contentFormat: BookContentFormat | null;
}
