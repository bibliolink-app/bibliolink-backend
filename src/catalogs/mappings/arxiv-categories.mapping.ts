import { BookCategoryCode as C } from '../enums/book-category-code.enum';
import { collectCategoryCodes } from './category-mapping.util';

// Archivos de la taxonomía de arXiv (https://arxiv.org/category_taxonomy).
// Cada categoría de arXiv es `archivo.subárea` (`cs.LG`) o solo el archivo
// (`quant-ph`); para clasificar alcanza con el archivo.
const ARCHIVES: Readonly<Record<string, readonly C[]>> = {
    'cs': [C.TECHNOLOGY],
    'eess': [C.TECHNOLOGY],
    'math': [C.MATHEMATICS],
    'stat': [C.MATHEMATICS],
    'math-ph': [C.NATURAL_SCIENCES],
    'physics': [C.NATURAL_SCIENCES],
    'astro-ph': [C.NATURAL_SCIENCES],
    'cond-mat': [C.NATURAL_SCIENCES],
    'gr-qc': [C.NATURAL_SCIENCES],
    'hep-ex': [C.NATURAL_SCIENCES],
    'hep-lat': [C.NATURAL_SCIENCES],
    'hep-ph': [C.NATURAL_SCIENCES],
    'hep-th': [C.NATURAL_SCIENCES],
    'nucl-ex': [C.NATURAL_SCIENCES],
    'nucl-th': [C.NATURAL_SCIENCES],
    'quant-ph': [C.NATURAL_SCIENCES],
    'nlin': [C.NATURAL_SCIENCES],
    'q-bio': [C.NATURAL_SCIENCES],
    'q-fin': [C.ECONOMICS_BUSINESS],
    'econ': [C.ECONOMICS_BUSINESS],
};

// Traduce las categorías de un artículo a la taxonomía de BiblioLink. La
// categoría principal va primero; después, las secundarias (cross-lists).
export function mapArxivCategories(
    primaryCategory: string | undefined,
    categories: readonly string[],
): C[] {
    const terms = primaryCategory ? [primaryCategory, ...categories] : categories;

    return collectCategoryCodes(
        terms.flatMap((term) => ARCHIVES[term.split('.')[0]!.toLowerCase()] ?? []),
    );
}
