import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from './i18n.constants';
import { MESSAGES, type MessageCode } from './messages';

// Valores que reemplazan los marcadores `{nombre}` de un mensaje.
export type MessageParams = Record<string, string | number>;

// Devuelve el texto de un código en el idioma pedido, con sus marcadores
// reemplazados. Un marcador sin valor queda tal cual.
export function translate(
    code: MessageCode,
    language: Language,
    params: MessageParams = {},
): string {
    const template = MESSAGES[language][code] ?? MESSAGES[DEFAULT_LANGUAGE][code];

    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        Object.hasOwn(params, name) ? String(params[name]) : placeholder,
    );
}

export function isMessageCode(value: unknown): value is MessageCode {
    return typeof value === 'string' && Object.hasOwn(MESSAGES[DEFAULT_LANGUAGE], value);
}

// Elige el idioma a partir de la cabecera `Accept-Language` que envía el
// frontend (por ejemplo, `fr-CA,fr;q=0.9,en;q=0.8`): el de mayor peso que
// BiblioLink tenga. Se compara solo el idioma principal, así `pt-BR` y
// `pt-PT` usan los mismos textos.
export function resolveLanguage(
    acceptLanguage: string | string[] | undefined,
): Language {
    const header = Array.isArray(acceptLanguage)
        ? acceptLanguage.join(',')
        : acceptLanguage;

    if (!header) {
        return DEFAULT_LANGUAGE;
    }

    const candidates = header
        .split(',')
        .map((part, index) => {
            const [tag = '', ...attributes] = part.split(';');
            const qualityAttribute = attributes
                .map((attribute) => attribute.trim())
                .find((attribute) => attribute.startsWith('q='));
            const quality = qualityAttribute ? Number(qualityAttribute.slice(2)) : 1;

            return {
                language: tag.trim().toLowerCase().split('-')[0] ?? '',
                quality: Number.isFinite(quality) ? quality : 0,
                index,
            };
        })
        // `q=0` significa "no quiero este idioma".
        .filter((candidate) => candidate.quality > 0)
        .sort((a, b) => b.quality - a.quality || a.index - b.index);

    for (const candidate of candidates) {
        if (isSupportedLanguage(candidate.language)) {
            return candidate.language;
        }
    }

    return DEFAULT_LANGUAGE;
}
