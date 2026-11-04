import {
    registerDecorator,
    ValidationOptions,
} from 'class-validator';

import { DEFAULT_LANGUAGE } from '../../i18n/i18n.constants';
import { localizedValidation } from '../../i18n/localized-validation';
import { translate } from '../../i18n/translate';

export function IsStrongPassword(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return (object: object, propertyName: string | symbol): void => {
        registerDecorator({
            name: 'isStrongPassword',
            target: object.constructor,
            propertyName: propertyName.toString(),
            options: {
                // Un mensaje personalizado conserva también su propio contexto.
                ...(validationOptions?.message === undefined
                    ? localizedValidation('VALIDATION_STRONG_PASSWORD')
                    : {}),
                ...validationOptions,
            },
            validator: {
                validate(value: unknown): boolean {
                    if (typeof value !== 'string') {
                        return false;
                    }

                    return Buffer.byteLength(value, 'utf8') <= 72
                        && Array.from(value).length >= 8
                        && /\p{L}/u.test(value)
                        && /\p{N}/u.test(value)
                        && /[\p{P}\p{S}]/u.test(value);
                },

                defaultMessage(
                ): string {
                    return translate('VALIDATION_STRONG_PASSWORD', DEFAULT_LANGUAGE);
                },
            },
        });
    };
}
