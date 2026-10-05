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
