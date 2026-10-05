// Formato del recurso al que apunta `contentReference`. Lo asigna cada
// proveedor en el mismo momento en que elige el enlace, a partir del tipo
// que el propio proveedor declara (MIME, tipo de enlace OPDS/Atom o campo de
// la API); nunca se deduce después mirando la extensión de la URL.
//
// Los valores se guardan tal cual en la columna `books.content_format`:
// agregar o renombrar uno requiere una migración.
export enum BookContentFormat {
    // Documento PDF.
    PDF = 'PDF',

    // Libro EPUB.
    EPUB = 'EPUB',

    // La obra completa como HTML o XHTML.
    HTML = 'HTML',

    // La obra completa como texto plano.
    TEXT = 'TEXT',

    // Una página web sobre la obra (ficha, resumen, DOI, repositorio), no el
    // contenido en sí. No se puede leer dentro de BiblioLink.
    EXTERNAL_PAGE = 'EXTERNAL_PAGE',

    // Un archivo con el contenido, pero en un formato que no se procesa.
    UNSUPPORTED = 'UNSUPPORTED',
}
