import type { Language } from './i18n.constants';

import enAnalytics from './locales/en/analytics.json';
import enAuth from './locales/en/auth.json';
import enBooks from './locales/en/books.json';
import enCaptcha from './locales/en/captcha.json';
import enCatalogs from './locales/en/catalogs.json';
import enCategories from './locales/en/categories.json';
import enCommon from './locales/en/common.json';
import enEmail from './locales/en/email.json';
import enFavorites from './locales/en/favorites.json';
import enReading from './locales/en/reading.json';
import enSubscriptions from './locales/en/subscriptions.json';
import enUsers from './locales/en/users.json';
import esAnalytics from './locales/es/analytics.json';
import esAuth from './locales/es/auth.json';
import esBooks from './locales/es/books.json';
import esCaptcha from './locales/es/captcha.json';
import esCatalogs from './locales/es/catalogs.json';
import esCategories from './locales/es/categories.json';
import esCommon from './locales/es/common.json';
import esEmail from './locales/es/email.json';
import esFavorites from './locales/es/favorites.json';
import esReading from './locales/es/reading.json';
import esSubscriptions from './locales/es/subscriptions.json';
import esUsers from './locales/es/users.json';
import frAnalytics from './locales/fr/analytics.json';
import frAuth from './locales/fr/auth.json';
import frBooks from './locales/fr/books.json';
import frCaptcha from './locales/fr/captcha.json';
import frCatalogs from './locales/fr/catalogs.json';
import frCategories from './locales/fr/categories.json';
import frCommon from './locales/fr/common.json';
import frEmail from './locales/fr/email.json';
import frFavorites from './locales/fr/favorites.json';
import frReading from './locales/fr/reading.json';
import frSubscriptions from './locales/fr/subscriptions.json';
import frUsers from './locales/fr/users.json';
import ptAnalytics from './locales/pt/analytics.json';
import ptAuth from './locales/pt/auth.json';
import ptBooks from './locales/pt/books.json';
import ptCaptcha from './locales/pt/captcha.json';
import ptCatalogs from './locales/pt/catalogs.json';
import ptCategories from './locales/pt/categories.json';
import ptCommon from './locales/pt/common.json';
import ptEmail from './locales/pt/email.json';
import ptFavorites from './locales/pt/favorites.json';
import ptReading from './locales/pt/reading.json';
import ptSubscriptions from './locales/pt/subscriptions.json';
import ptUsers from './locales/pt/users.json';

// Los JSON se importan (en vez de leerse del disco) para que el compilador
// los copie a `dist` y Vercel los incluya en la función sin configuración.

// El español es la referencia: un código nuevo se agrega primero en
// `locales/es/` y después en los demás idiomas. Si a un idioma le falta un
// código, el proyecto no compila.
const es = { ...esCommon, ...esAuth, ...esUsers, ...esEmail, ...esCaptcha, ...esAnalytics, ...esReading, ...esSubscriptions, ...esCatalogs, ...esCategories, ...esFavorites, ...esBooks };

// Código estable de cada mensaje. Es lo que el frontend recibe en `code`.
export type MessageCode = keyof typeof es;

type Messages = Record<MessageCode, string>;

export const MESSAGES: Record<Language, Messages> = {
    es,
    en: { ...enCommon, ...enAuth, ...enUsers, ...enEmail, ...enCaptcha, ...enAnalytics, ...enReading, ...enSubscriptions, ...enCatalogs, ...enCategories, ...enFavorites, ...enBooks },
    fr: { ...frCommon, ...frAuth, ...frUsers, ...frEmail, ...frCaptcha, ...frAnalytics, ...frReading, ...frSubscriptions, ...frCatalogs, ...frCategories, ...frFavorites, ...frBooks },
    pt: { ...ptCommon, ...ptAuth, ...ptUsers, ...ptEmail, ...ptCaptcha, ...ptAnalytics, ...ptReading, ...ptSubscriptions, ...ptCatalogs, ...ptCategories, ...ptFavorites, ...ptBooks },
};
