import { BookCategoryCode as C } from '../enums/book-category-code.enum';
import { collectCategoryCodes, createMappingTable, toMappingKey, } from './category-mapping.util';

// Vocabulario propio de Standard Ebooks. Sus obras también traen temas LCSH,
// pero este vocabulario es corto, controlado y ya está a nivel de género.
export const STANDARD_EBOOKS_SUBJECT_SCHEME = 'https://standardebooks.org/vocab/subjects';

// Los 19 temas de https://standardebooks.org/ebooks. "Nonfiction" no se
// traduce: no dice de qué trata la obra.
const SUBJECTS = createMappingTable({
    'Adventure': [C.ADVENTURE],
    'Autobiography': [C.BIOGRAPHY],
    'Biography': [C.BIOGRAPHY],
    'Memoir': [C.BIOGRAPHY],
    "Children's": [C.CHILDREN_YOUNG_ADULT],
    'Comedy': [C.HUMOR],
    'Satire': [C.HUMOR],
    'Drama': [C.DRAMA],
    'Fantasy': [C.SCIENCE_FICTION_FANTASY],
    'Science Fiction': [C.SCIENCE_FICTION_FANTASY],
    'Fiction': [C.FICTION],
    'Horror': [C.HORROR],
    'Mystery': [C.MYSTERY_THRILLER],
    'Philosophy': [C.PHILOSOPHY_RELIGION],
    'Spirituality': [C.PHILOSOPHY_RELIGION],
    'Poetry': [C.POETRY],
    'Shorts': [C.SHORT_STORIES, C.FICTION],
    'Travel': [C.TRAVEL],
});

export interface StandardEbooksSubject {
    name?: string;
    scheme?: string;
}

// Traduce los temas del vocabulario de Standard Ebooks a la taxonomía de
// BiblioLink, en el orden en que los publica el feed.
export function mapStandardEbooksCategories(
    subjects: readonly StandardEbooksSubject[],
): C[] {
    return collectCategoryCodes(
        subjects
            .filter((subject) => subject.scheme === STANDARD_EBOOKS_SUBJECT_SCHEME)
            .flatMap((subject) =>
                typeof subject.name === 'string'
                    ? SUBJECTS[toMappingKey(subject.name)] ?? []
                    : [],
            ),
    );
}
