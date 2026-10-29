import type { Language } from './i18n.constants';

import enBooks from './locales/en/books.json';
import enCatalogs from './locales/en/catalogs.json';
import enCategories from './locales/en/categories.json';
import enCommon from './locales/en/common.json';
import enFavorites from './locales/en/favorites.json';
import esBooks from './locales/es/books.json';
import esCatalogs from './locales/es/catalogs.json';
import esCategories from './locales/es/categories.json';
import esCommon from './locales/es/common.json';
import esFavorites from './locales/es/favorites.json';
import frBooks from './locales/fr/books.json';
import frCatalogs from './locales/fr/catalogs.json';
import frCategories from './locales/fr/categories.json';
import frCommon from './locales/fr/common.json';
import frFavorites from './locales/fr/favorites.json';
import ptBooks from './locales/pt/books.json';
import ptCatalogs from './locales/pt/catalogs.json';
import ptCategories from './locales/pt/categories.json';
import ptCommon from './locales/pt/common.json';
import ptFavorites from './locales/pt/favorites.json';

// Los JSON se importan (en vez de leerse del disco) para que el compilador
// los copie a `dist` y Vercel los incluya en la función sin configuración.

// El español es la referencia: un código nuevo se agrega primero en
// `locales/es/` y después en los demás idiomas. Si a un idioma le falta un
// código, el proyecto no compila.
const es = { ...esCommon, ...esCatalogs, ...esCategories, ...esFavorites, ...esBooks };

// Código estable de cada mensaje. Es lo que el frontend recibe en `code`.
export type MessageCode = keyof typeof es;

type Messages = Record<MessageCode, string>;

export const MESSAGES: Record<Language, Messages> = {
    es,
    en: { ...enCommon, ...enCatalogs, ...enCategories, ...enFavorites, ...enBooks },
    fr: { ...frCommon, ...frCatalogs, ...frCategories, ...frFavorites, ...frBooks },
    pt: { ...ptCommon, ...ptCatalogs, ...ptCategories, ...ptFavorites, ...ptBooks },
};
