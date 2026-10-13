import { BookCategoryCode as C } from '../enums/book-category-code.enum';
import { collectCategoryCodes, createMappingTable, toMappingKey, } from './category-mapping.util';

// Los 26 campos de OpenAlex (https://api.openalex.org/fields).
const FIELDS = createMappingTable({
    'Agricultural and Biological Sciences': [C.NATURAL_SCIENCES],
    'Biochemistry, Genetics and Molecular Biology': [C.NATURAL_SCIENCES],
    'Business, Management and Accounting': [C.ECONOMICS_BUSINESS],
    'Chemical Engineering': [C.TECHNOLOGY],
    'Chemistry': [C.NATURAL_SCIENCES],
    'Computer Science': [C.TECHNOLOGY],
    'Decision Sciences': [C.ECONOMICS_BUSINESS],
    'Dentistry': [C.HEALTH],
    'Earth and Planetary Sciences': [C.NATURAL_SCIENCES],
    'Economics, Econometrics and Finance': [C.ECONOMICS_BUSINESS],
    'Energy': [C.TECHNOLOGY],
    'Engineering': [C.TECHNOLOGY],
    'Environmental Science': [C.NATURAL_SCIENCES],
    'Health Professions': [C.HEALTH],
    'Immunology and Microbiology': [C.NATURAL_SCIENCES],
    'Materials Science': [C.NATURAL_SCIENCES],
    'Mathematics': [C.MATHEMATICS],
    'Medicine': [C.HEALTH],
    'Neuroscience': [C.NATURAL_SCIENCES],
    'Nursing': [C.HEALTH],
    'Pharmacology, Toxicology and Pharmaceutics': [C.HEALTH],
    'Physics and Astronomy': [C.NATURAL_SCIENCES],
    'Psychology': [C.SOCIAL_SCIENCES],
    'Social Sciences': [C.SOCIAL_SCIENCES],
    'Veterinary': [C.HEALTH],
    // "Arts and Humanities" se resuelve por subcampo, más abajo.
});

// "Arts and Humanities" agrupa disciplinas muy distintas (historia, filosofía,
// música), así que se traduce según su subcampo.
const ARTS_AND_HUMANITIES = toMappingKey('Arts and Humanities');

const ARTS_AND_HUMANITIES_SUBFIELDS = createMappingTable({
    'History': [C.HISTORY],
    'Archeology': [C.HISTORY],
    'Classics': [C.HISTORY],
    'History and Philosophy of Science': [C.HISTORY],
    'Philosophy': [C.PHILOSOPHY_RELIGION],
    'Religious studies': [C.PHILOSOPHY_RELIGION],
    'Literature and Literary Theory': [C.LANGUAGE_EDUCATION],
    'Language and Linguistics': [C.LANGUAGE_EDUCATION],
    'Visual Arts and Performing Arts': [C.ARTS],
    'Music': [C.ARTS],
    'Museology': [C.ARTS],
    'Conservation': [C.ARTS],
    'General Arts and Humanities': [C.ARTS],
});

export interface OpenAlexPrimaryTopic {
    field?: { display_name?: string } | null;
    subfield?: { display_name?: string } | null;
}

// Traduce el tema principal de un trabajo a la taxonomía de BiblioLink.
export function mapOpenAlexCategories(
    primaryTopic: OpenAlexPrimaryTopic | null | undefined,
): C[] {
    const field = primaryTopic?.field?.display_name;

    if (typeof field !== 'string') {
        return [];
    }

    const fieldKey = toMappingKey(field);

    if (fieldKey === ARTS_AND_HUMANITIES) {
        const subfield = primaryTopic?.subfield?.display_name;

        return collectCategoryCodes(
            typeof subfield === 'string'
                ? ARTS_AND_HUMANITIES_SUBFIELDS[toMappingKey(subfield)] ?? [C.ARTS]
                : [C.ARTS],
        );
    }

    return collectCategoryCodes(FIELDS[fieldKey] ?? []);
}
