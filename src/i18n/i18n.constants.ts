// Idiomas que ofrece el frontend. Cada uno tiene su carpeta en `locales/`.
export const SUPPORTED_LANGUAGES = ['es', 'en', 'fr', 'pt'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

// Se usa cuando el cliente no envía `Accept-Language` o pide un idioma que
// BiblioLink no tiene. También es el idioma de los registros del servidor.
export const DEFAULT_LANGUAGE: Language = 'es';

export function isSupportedLanguage(value: string): value is Language {
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
