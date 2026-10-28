import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { READABLE_CONTENT_FORMATS } from '../../catalogs/utils/book-content.util';

// Parámetro con los formatos legibles, para las consultas que usan
// `readableBookCondition`.
export const READABLE_BOOK_PARAMETERS = {
    readableContentFormats: [...READABLE_CONTENT_FORMATS],
};

// Condición SQL de "la obra se puede leer dentro de BiblioLink" para un alias
// de la entidad `Book`. Las obras que no la cumplen (páginas externas,
// formatos no soportados, sin contenido o importadas antes de guardar el
// formato) no se muestran en ningún listado ni detalle, pero no se borran:
// si se vuelven a importar y resultan legibles, reaparecen.
export function readableBookCondition(alias: string): string {
    return `${alias}.contentReference IS NOT NULL AND ${alias}.contentFormat IN (:...readableContentFormats)`;
}

// Agrega la condición a una consulta sobre `Book`.
export function andWhereBookIsReadable<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    alias: string,
): SelectQueryBuilder<T> {
    return queryBuilder.andWhere(readableBookCondition(alias), READABLE_BOOK_PARAMETERS);
}
