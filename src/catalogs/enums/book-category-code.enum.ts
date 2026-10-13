// Taxonomía propia de BiblioLink. Es una lista fija: cada proveedor traduce su
// propia clasificación a estos códigos (ver `src/catalogs/mappings/`) y la
// importación nunca crea categorías nuevas.
//
// Cada valor debe existir como fila en la tabla `categories` con el mismo
// `code`. Agregar o renombrar uno requiere una migración que la actualice.
export enum BookCategoryCode {
    // Literatura
    FICTION = 'fiction',
    CLASSICS = 'classics',
    SCIENCE_FICTION_FANTASY = 'science-fiction-fantasy',
    MYSTERY_THRILLER = 'mystery-thriller',
    HORROR = 'horror',
    ROMANCE = 'romance',
    ADVENTURE = 'adventure',
    HISTORICAL_FICTION = 'historical-fiction',
    SHORT_STORIES = 'short-stories',
    POETRY = 'poetry',
    DRAMA = 'drama',
    HUMOR = 'humor',
    MYTHOLOGY_FOLKLORE = 'mythology-folklore',
    CHILDREN_YOUNG_ADULT = 'children-young-adult',
    ESSAYS = 'essays',

    // No ficción y académico
    BIOGRAPHY = 'biography',
    HISTORY = 'history',
    PHILOSOPHY_RELIGION = 'philosophy-religion',
    SOCIAL_SCIENCES = 'social-sciences',
    ECONOMICS_BUSINESS = 'economics-business',
    NATURAL_SCIENCES = 'natural-sciences',
    MATHEMATICS = 'mathematics',
    TECHNOLOGY = 'technology',
    HEALTH = 'health',
    ARTS = 'arts',
    LANGUAGE_EDUCATION = 'language-education',
    TRAVEL = 'travel',
    LIFESTYLE = 'lifestyle',
}
