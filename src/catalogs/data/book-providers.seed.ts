import { BookProviderCode } from '../enums/book-provider-code.enum';

// Describe un proveedor externo tal como debe quedar registrado
// en la tabla `book_providers`.
export interface BookProviderSeed {
    code: BookProviderCode;
    name: string;
    active: boolean;
}

// Proveedores de contenido con los que trabaja BiblioLink.
// Cada código debe tener su implementación registrada en `CatalogsModule`.
export const BOOK_PROVIDERS_SEED: readonly BookProviderSeed[] = [
    {
        code: BookProviderCode.GUTENDEX,
        name: 'Project Gutenberg (Gutendex)',
        active: true,
    },
    {
        code: BookProviderCode.STANDARD_EBOOKS,
        name: 'Standard Ebooks',
        active: true,
    },
    {
        code: BookProviderCode.ARXIV,
        name: 'arXiv',
        active: true,
    },
    {
        code: BookProviderCode.OPENALEX,
        name: 'OpenAlex',
        active: true,
    },
];
