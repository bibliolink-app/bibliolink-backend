import { BookContentFormat } from '../enums/book-content-format.enum';
import { toNullableUrl } from './catalog-text.util';

// Enlace al contenido de una obra junto con su formato. Viajan siempre juntos
// para que el formato quede fijado en el mismo momento en que se elige el
// enlace: o hay ambos, o no hay ninguno.
export interface BookContent {
    contentReference: string | null;
    contentFormat: BookContentFormat | null;
}

// Obra sin ningún enlace de contenido utilizable.
export const NO_BOOK_CONTENT: BookContent = {
    contentReference: null,
    contentFormat: null,
};

// Formatos que Reading puede mostrar dentro de BiblioLink. Una obra con otro
// formato (`EXTERNAL_PAGE`, `UNSUPPORTED`) o sin contenido solo se podría leer
// saliendo de la página, así que no se muestra en búsquedas ni listados.
export const READABLE_CONTENT_FORMATS: readonly BookContentFormat[] = [
    BookContentFormat.PDF,
    BookContentFormat.EPUB,
    BookContentFormat.HTML,
    BookContentFormat.TEXT,
];

// Indica si la obra se puede leer dentro de BiblioLink.
export function isReadableContent(content: BookContent): boolean {
    return (
        content.contentReference !== null &&
        content.contentFormat !== null &&
        READABLE_CONTENT_FORMATS.includes(content.contentFormat)
    );
}

// Arma el par enlace + formato. Si la URL no es válida no se conserva el
// formato: un formato sin enlace no describiría nada.
export function toBookContent(
    url: unknown,
    contentFormat: BookContentFormat,
): BookContent {
    const contentReference = toNullableUrl(url);

    return contentReference === null
        ? NO_BOOK_CONTENT
        : { contentReference, contentFormat };
}
