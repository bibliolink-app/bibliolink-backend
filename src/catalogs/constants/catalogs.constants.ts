import { envs } from '../../config/envs';

// Token de inyección con el que se agrupan todos los proveedores externos.
export const BOOK_CATALOG_PROVIDERS = Symbol('BOOK_CATALOG_PROVIDERS');

// Paginación aplicada a las búsquedas del catálogo.
export const CATALOG_DEFAULT_PAGE_SIZE = 20;
export const CATALOG_MAX_PAGE_SIZE = 50;

// Tiempo máximo de espera para cada llamada a una API externa.
export const CATALOG_REQUEST_TIMEOUT_MS = envs.catalog.requestTimeoutMs;

// Identifica a BiblioLink ante las APIs externas. Varias de ellas piden un
// agente de usuario descriptivo con una forma de contacto.
export const CATALOG_USER_AGENT =
    `BiblioLink/1.0 (+${envs.frontendUrl}; mailto:${envs.catalog.contactEmail})`;

// Longitudes máximas de las columnas de `books`. Los datos externos se
// recortan antes de exponerse para que siempre quepan en la base de datos.
export const BOOK_EXTERNAL_REFERENCE_MAX_LENGTH = 255;
export const BOOK_TITLE_MAX_LENGTH = 500;
export const BOOK_URL_MAX_LENGTH = 2048;
export const BOOK_AUTHOR_NAME_MAX_LENGTH = 255;
export const BOOK_LANGUAGE_CODE_MAX_LENGTH = 10;

// `book_authors` ordena a los autores en una columna `tinyint` sin signo.
export const BOOK_MAX_AUTHORS = 255;

// Tope de categorías por obra. Cada proveedor entrega las categorías de la
// más a la menos descriptiva y solo se conservan las primeras.
export const BOOK_MAX_CATEGORIES = 10;
