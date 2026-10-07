import { BOOK_MAX_CATEGORIES } from '../constants/catalogs.constants';
import { BookCategoryCode } from '../enums/book-category-code.enum';

// Tabla de traducción de la clasificación de un proveedor a la taxonomía de
// BiblioLink. Una entrada puede apuntar a varias categorías.
export type CategoryMappingTable = Readonly<Record<string, readonly BookCategoryCode[]>>;

// Clave para buscar un texto del proveedor en una tabla de traducción: sin
// mayúsculas, sin acentos, con `&` escrito como `and` y espacios simples. Así
// `Crime, Thrillers & Mystery` y `Crime, Thrillers and Mystery` coinciden.
export function toMappingKey(value: string): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Construye una tabla cuyas claves ya están normalizadas con `toMappingKey`,
// para poder escribirlas tal como las publica el proveedor.
export function createMappingTable(
    entries: Record<string, readonly BookCategoryCode[]>,
): CategoryMappingTable {
    return Object.fromEntries(
        Object.entries(entries).map(([key, codes]) => [toMappingKey(key), codes]),
    );
}

// Deja la lista final de categorías de una obra: sin repetidos, en el orden
// recibido (el proveedor pasa primero las más descriptivas) y con el máximo
// de categorías por obra.
export function collectCategoryCodes(
    codes: Iterable<BookCategoryCode>,
): BookCategoryCode[] {
    return [...new Set(codes)].slice(0, BOOK_MAX_CATEGORIES);
}
