import { BOOK_AUTHOR_NAME_MAX_LENGTH, BOOK_CATEGORY_NAME_MAX_LENGTH, BOOK_LANGUAGE_CODE_MAX_LENGTH, BOOK_MAX_AUTHORS, BOOK_MAX_CATEGORIES, BOOK_URL_MAX_LENGTH, } from '../constants/catalogs.constants';

// Herramientas compartidas para limpiar el texto que llega de las APIs
// externas antes de exponerlo o guardarlo en la base de datos.

// Sustituye cualquier bloque de espacios o saltos de línea por un solo espacio.
export function collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

// Elimina etiquetas HTML y deja únicamente el texto legible.
export function stripHtml(value: string): string {
    return collapseWhitespace(value.replace(/<[^>]*>/g, ' '));
}

// Recorta el texto para que nunca supere el largo de su columna.
export function truncate(value: string, maxLength: number): string {
    return value.length > maxLength
        ? value.slice(0, maxLength)
        : value;
}

// Devuelve un texto limpio o `null` cuando el proveedor no aporta contenido.
export function toNullableText(
    value: unknown,
    maxLength?: number,
): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const cleaned = collapseWhitespace(value);

    if (cleaned.length === 0) {
        return null;
    }

    return maxLength ? truncate(cleaned, maxLength) : cleaned;
}

// Acepta una URL solo si es http(s) y cabe en la columna correspondiente.
export function toNullableUrl(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const candidate = value.trim();

    if (candidate.length === 0 || candidate.length > BOOK_URL_MAX_LENGTH) {
        return null;
    }

    if (!/^https?:\/\//i.test(candidate)) {
        return null;
    }

    return candidate;
}

// Normaliza el código de idioma al subtag principal en minúsculas
// (`en-GB` se guarda como `en`) para que coincida con la tabla `languages`.
export function normalizeLanguageCode(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const primarySubtag = value.trim().split(/[-_]/)[0]?.toLowerCase() ?? '';

    if (!/^[a-z]{2,3}$/.test(primarySubtag)) {
        return null;
    }

    return truncate(primarySubtag, BOOK_LANGUAGE_CODE_MAX_LENGTH);
}

// Limpia una lista de idiomas descartando repetidos y valores inválidos.
export function normalizeLanguageCodes(values: unknown): string[] {
    const source = Array.isArray(values) ? values : [values];
    const normalized = source
        .map((value) => normalizeLanguageCode(value))
        .filter((value): value is string => value !== null);

    return [...new Set(normalized)];
}

// Convierte un nombre invertido (`Stoker, Bram`) al orden natural
// (`Bram Stoker`). Los nombres con varias comas se dejan intactos porque
// suelen incluir títulos o fechas que no conviene reordenar.
export function formatPersonName(value: string): string {
    const cleaned = collapseWhitespace(value);
    const parts = cleaned.split(',');

    if (parts.length !== 2) {
        return cleaned;
    }

    const surname = parts[0]!.trim();
    const givenName = parts[1]!.trim();

    if (surname.length === 0 || givenName.length === 0) {
        return cleaned;
    }

    return `${givenName} ${surname}`;
}

// Deja la lista de autores lista para `book_authors`: sin vacíos,
// sin repetidos, recortada al largo de la columna y al máximo de filas.
export function normalizeAuthorNames(values: readonly unknown[]): string[] {
    const normalized = values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => formatPersonName(value))
        .filter((value) => value.length > 0)
        .map((value) => truncate(value, BOOK_AUTHOR_NAME_MAX_LENGTH));

    return [...new Set(normalized)].slice(0, BOOK_MAX_AUTHORS);
}

// Varias APIs devuelven un objeto suelto cuando hay un único elemento
// y un arreglo cuando hay varios. Esto unifica ambos casos.
export function toArray<T>(value: T | T[] | undefined | null): T[] {
    if (value === undefined || value === null) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

// Deja la lista de categorías lista para `categories`: sin vacíos, sin
// repetidos, recortada al largo de la columna y al máximo de filas.
// Varios proveedores publican el mismo descriptor con distinta capitalización,
// así que la comparación de duplicados ignora mayúsculas.
export function normalizeCategoryNames(values: readonly unknown[]): string[] {
    const vistos = new Map<string, string>();

    for (const value of values) {
        if (typeof value !== 'string') {
            continue;
        }

        const limpio = truncate(
            collapseWhitespace(value),
            BOOK_CATEGORY_NAME_MAX_LENGTH,
        );

        if (limpio.length === 0) {
            continue;
        }

        const clave = limpio.toLowerCase();

        if (!vistos.has(clave)) {
            vistos.set(clave, limpio);
        }
    }

    return [...vistos.values()].slice(0, BOOK_MAX_CATEGORIES);
}
