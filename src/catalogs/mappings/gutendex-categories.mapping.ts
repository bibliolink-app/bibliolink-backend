import { BookCategoryCode as C } from '../enums/book-category-code.enum';
import { collectCategoryCodes, createMappingTable, toMappingKey, } from './category-mapping.util';

// Prefijo de las colecciones curadas de Project Gutenberg, su clasificación
// general (https://www.gutenberg.org/ebooks/categories).
const CURATED_PREFIX = 'category:';

// Colecciones curadas de Gutenberg. Las que no aportan un tema (literatura por
// nacionalidad, "Literature - Other", erotismo) no se traducen.
const CURATED_CATEGORIES = createMappingTable({
    // Literature
    'Adventure': [C.ADVENTURE],
    'Classics of Literature': [C.CLASSICS],
    'Biographies': [C.BIOGRAPHY],
    'Novels': [C.FICTION],
    'Short Stories': [C.SHORT_STORIES, C.FICTION],
    'Poetry': [C.POETRY],
    'Plays/Films/Dramas': [C.DRAMA],
    'Romance': [C.ROMANCE],
    'Science-Fiction & Fantasy': [C.SCIENCE_FICTION_FANTASY],
    'Crime, Thrillers & Mystery': [C.MYSTERY_THRILLER],
    'Mythology, Legends & Folklore': [C.MYTHOLOGY_FOLKLORE],
    'Humour': [C.HUMOR],
    'Children & Young Adult Reading': [C.CHILDREN_YOUNG_ADULT],
    'Historical Novels': [C.HISTORICAL_FICTION, C.FICTION],

    // Science & Technology
    'Engineering & Technology': [C.TECHNOLOGY],
    'Mathematics': [C.MATHEMATICS],
    'Science - Physics': [C.NATURAL_SCIENCES],
    'Science - Chemistry/Biochemistry': [C.NATURAL_SCIENCES],
    'Science - Biology': [C.NATURAL_SCIENCES],
    'Science - Earth/Agricultural/Farming': [C.NATURAL_SCIENCES],
    'Research Methods/Statistics/Information Sys': [C.MATHEMATICS],
    'Environmental Issues': [C.NATURAL_SCIENCES],

    // History (las "History - …" se resuelven por prefijo, más abajo)
    'Archaeology & Anthropology': [C.HISTORY],

    // Social Sciences & Society
    'Business/Management': [C.ECONOMICS_BUSINESS],
    'Economics': [C.ECONOMICS_BUSINESS],
    'Law & Criminology': [C.SOCIAL_SCIENCES],
    'Gender & Sexuality Studies': [C.SOCIAL_SCIENCES],
    'Psychiatry/Psychology': [C.SOCIAL_SCIENCES],
    'Sociology': [C.SOCIAL_SCIENCES],
    'Politics': [C.SOCIAL_SCIENCES],
    'Parenthood & Family Relations': [C.SOCIAL_SCIENCES],
    'Old Age & the Elderly': [C.SOCIAL_SCIENCES],

    // Arts & Culture
    'Art': [C.ARTS],
    'Architecture': [C.ARTS],
    'Music': [C.ARTS],
    'Fashion': [C.ARTS],
    'Journalism/Media/Writing': [C.LANGUAGE_EDUCATION],
    'Language & Communication': [C.LANGUAGE_EDUCATION],
    'Essays, Letters & Speeches': [C.ESSAYS],

    // Religion & Philosophy
    'Religion/Spirituality': [C.PHILOSOPHY_RELIGION],
    'Philosophy & Ethics': [C.PHILOSOPHY_RELIGION],

    // Lifestyle & Hobbies
    'Cooking & Drinking': [C.LIFESTYLE],
    'Sports/Hobbies': [C.LIFESTYLE],
    'How To ...': [C.LIFESTYLE],
    'Nature/Gardening/Animals': [C.LIFESTYLE],
    'Travel Writing': [C.TRAVEL],

    // Health & Medicine
    'Health & Medicine': [C.HEALTH],
    'Drugs/Alcohol/Pharmacology': [C.HEALTH],
    'Nutrition': [C.HEALTH],

    // Education & Reference
    'Encyclopedias/Dictionaries/Reference': [C.LANGUAGE_EDUCATION],
    'Teaching & Education': [C.LANGUAGE_EDUCATION],
    'Reports & Conference Proceedings': [C.LANGUAGE_EDUCATION],
    'Journals': [C.LANGUAGE_EDUCATION],
});

// Todas las colecciones "History - American", "History - Ancient", etc.
const CURATED_HISTORY_PREFIX = toMappingKey('History - ');

// Reglas de respaldo sobre los temas (LCSH) y las demás colecciones. Solo se
// aplican a las obras que no tienen ninguna colección curada que se pueda
// traducir (alrededor de una de cada diez), como "Treasure Island".
interface FallbackRule {
    pattern: RegExp;
    codes: readonly C[];
}

// Géneros: se aplican siempre.
const GENRE_RULES: readonly FallbackRule[] = [
    { pattern: /science fiction|fantasy/, codes: [C.SCIENCE_FICTION_FANTASY] },
    { pattern: /horror|ghost stories|gothic/, codes: [C.HORROR] },
    { pattern: /detective|mystery|crime fiction|thriller/, codes: [C.MYSTERY_THRILLER] },
    { pattern: /love stories/, codes: [C.ROMANCE] },
    { pattern: /adventure|sea stories|pirates/, codes: [C.ADVENTURE] },
    // También `England -- History -- 19th century -- Fiction`.
    { pattern: /historical fiction|\bhistory\b.*\bfiction\b/, codes: [C.HISTORICAL_FICTION] },
    { pattern: /short stories/, codes: [C.SHORT_STORIES] },
    { pattern: /poetry|poems/, codes: [C.POETRY] },
    { pattern: /drama|\bplays\b|tragedies|comedies/, codes: [C.DRAMA] },
    { pattern: /humou?r|satire/, codes: [C.HUMOR] },
    { pattern: /mytholog|folklore|legends|fairy tales/, codes: [C.MYTHOLOGY_FOLKLORE] },
    { pattern: /juvenile|children/, codes: [C.CHILDREN_YOUNG_ADULT] },
];

// Temas de no ficción: solo se aplican a temas que no son de ficción, para
// que "England -- History -- Fiction" no termine en Historia.
const NONFICTION_RULES: readonly FallbackRule[] = [
    { pattern: /natural history|biology|botany|zoology|evolution|natural selection|chemistry|physics|astronomy|geology/, codes: [C.NATURAL_SCIENCES] },
    { pattern: /biograph|memoir|diaries/, codes: [C.BIOGRAPHY] },
    { pattern: /(?<!natural )\bhistory\b/, codes: [C.HISTORY] },
    { pattern: /philosophy|religion|theology|ethics|bible|christian/, codes: [C.PHILOSOPHY_RELIGION] },
    { pattern: /travel|voyages/, codes: [C.TRAVEL] },
    { pattern: /medicine|medical|hygiene/, codes: [C.HEALTH] },
    { pattern: /cook/, codes: [C.LIFESTYLE] },
];

// Un tema "de ficción" en LCSH lleva la forma literaria en el texto
// (`Pirates -- Fiction`, `Sea stories`, `Horror tales`).
const FICTION_FORM = /fiction|stories|tales|\bnovels?\b/;
const NONFICTION_FORM = /non-?fiction/;

// Traduce los temas y colecciones de una obra de Gutendex a la taxonomía de
// BiblioLink, de la categoría más descriptiva a la menos descriptiva.
export function mapGutendexCategories(
    subjects: readonly unknown[],
    bookshelves: readonly unknown[],
): C[] {
    const shelfKeys = bookshelves.filter(isString).map(toMappingKey);
    const subjectKeys = subjects.filter(isString).map(toMappingKey);

    const curatedCodes = shelfKeys
        .filter((key) => key.startsWith(CURATED_PREFIX))
        .flatMap((key) => mapCuratedCategory(key.slice(CURATED_PREFIX.length).trim()));

    if (curatedCodes.length > 0) {
        return collectCategoryCodes(curatedCodes);
    }

    const fallbackCodes: C[] = [];

    for (const key of [...subjectKeys, ...shelfKeys]) {
        const isFiction = FICTION_FORM.test(key) && !NONFICTION_FORM.test(key);
        const rules = isFiction ? GENRE_RULES : [...GENRE_RULES, ...NONFICTION_RULES];

        for (const rule of rules) {
            if (rule.pattern.test(key)) {
                fallbackCodes.push(...rule.codes);
            }
        }

        if (isFiction) {
            fallbackCodes.push(C.FICTION);
        }
    }

    return collectCategoryCodes(fallbackCodes);
}

function mapCuratedCategory(key: string): readonly C[] {
    if (key.startsWith(CURATED_HISTORY_PREFIX)) {
        return [C.HISTORY];
    }

    return CURATED_CATEGORIES[key] ?? [];
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}
