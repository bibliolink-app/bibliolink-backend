// Límite de páginas que recorre una carga masiva antes de detenerse, aunque
// el proveedor todavía tenga más resultados. Es necesario porque "traer todo"
// no significa lo mismo para cada proveedor: OpenAlex indexa cientos de
// millones de obras, Gutendex ronda las 75 000, y arXiv exige además un
// mínimo de 3 segundos entre solicitudes. Sin este límite, una carga masiva
// sin filtros podría tardar horas o días.
export const BOOKS_BULK_IMPORT_DEFAULT_MAX_PAGES = 20;
export const BOOKS_BULK_IMPORT_HARD_MAX_PAGES = 500;
