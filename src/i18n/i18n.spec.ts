import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { SearchCatalogDto } from '../catalogs/dto/search-catalog.dto';
import { CATALOG_MAX_PAGE_SIZE } from '../catalogs/constants/catalogs.constants';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './i18n.constants';
import { localizedError } from './localized-error';
import { createValidationException, type ValidationErrorBody } from './localized-validation';
import { MESSAGES } from './messages';
import { resolveLanguage, translate } from './translate';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('archivos de idioma', () => {
    const referenceCodes = Object.keys(MESSAGES[DEFAULT_LANGUAGE]).sort();

    it.each(SUPPORTED_LANGUAGES)('%s tiene exactamente los mismos códigos que el español', (language) => {
        expect(Object.keys(MESSAGES[language]).sort()).toEqual(referenceCodes);
    });

    it.each(SUPPORTED_LANGUAGES)('%s usa los mismos marcadores que el español y ningún texto vacío', (language) => {
        for (const code of referenceCodes) {
            const text = MESSAGES[language][code as keyof (typeof MESSAGES)['es']];
            expect(text.trim(), `${language}.${code}`).not.toBe('');
            expect(placeholders(text), `${language}.${code}`).toEqual(
                placeholders(MESSAGES.es[code as keyof (typeof MESSAGES)['es']]),
            );
        }
    });
});

describe('resolveLanguage', () => {
    it.each([
        [undefined, 'es'],
        ['', 'es'],
        ['en', 'en'],
        ['fr-CA,fr;q=0.9,en;q=0.8', 'fr'],
        ['pt-BR', 'pt'],
        ['de-DE,de;q=0.9,en;q=0.5', 'en'],
        ['de', 'es'],
        ['en;q=0.2,fr;q=0.8', 'fr'],
        ['fr;q=0,en', 'en'],
        ['EN-us', 'en'],
        [['pt', 'en'], 'pt'],
    ])('%j → %s', (header, expected) => {
        expect(resolveLanguage(header)).toBe(expected);
    });
});

describe('translate', () => {
    it('reemplaza los marcadores en cada idioma', () => {
        const params = { limit: 3, premiumLimit: 50 };
        expect(translate('FAVORITE_LIMIT_REACHED_FREE', 'es', params)).toBe(
            'Alcanzaste el límite de 3 favoritos del plan gratuito. Hazte Premium para guardar hasta 50.',
        );
        expect(translate('FAVORITE_LIMIT_REACHED_FREE', 'en', params)).toBe(
            'You reached the limit of 3 favorites on the free plan. Go Premium to save up to 50.',
        );
    });

    it('deja un marcador sin valor tal cual', () => {
        expect(translate('CATEGORY_NOT_FOUND', 'fr')).toBe("La catégorie n'existe pas.");
        expect(translate('CATALOG_PROVIDER_DISABLED', 'pt')).toBe('O provedor "{providerCode}" está desativado.');
    });
});

describe('localizedError', () => {
    it('lleva el código, los parámetros y el texto en español para los registros', () => {
        expect(localizedError('CATALOG_PROVIDER_DISABLED', { providerCode: 'arxiv' })).toEqual({
            code: 'CATALOG_PROVIDER_DISABLED',
            params: { providerCode: 'arxiv' },
            message: 'El proveedor "arxiv" está desactivado.',
        });
    });
});

describe('createValidationException', () => {
    const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: createValidationException,
    });

    async function validate(value: object): Promise<ValidationErrorBody> {
        try {
            await pipe.transform(value, { type: 'query', metatype: SearchCatalogDto });
        } catch (error: unknown) {
            return (error as { getResponse(): ValidationErrorBody }).getResponse();
        }

        throw new Error('Se esperaba un error de validación');
    }

    it('devuelve un código por cada campo inválido', async () => {
        const body = await validate({ pageSize: '999', extra: 'x' });

        expect(body.code).toBe('VALIDATION_FAILED');
        expect(body.details).toEqual(expect.arrayContaining([
            {
                field: 'pageSize',
                code: 'VALIDATION_PAGE_SIZE_MAX',
                params: { max: CATALOG_MAX_PAGE_SIZE },
                message: `El tamaño de página no puede superar ${CATALOG_MAX_PAGE_SIZE}.`,
            },
            {
                field: 'extra',
                code: 'VALIDATION_PROPERTY_NOT_ALLOWED',
                params: { property: 'extra' },
                message: 'El campo "extra" no está permitido.',
            },
        ]));
        expect(body.message).toHaveLength(body.details.length);
    });
});
