import {
    registerDecorator,
    ValidationOptions,
} from 'class-validator';

export function IsStrongPassword(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return (object: object, propertyName: string | symbol): void => {
        registerDecorator({
            name: 'isStrongPassword',
            target: object.constructor,
            propertyName: propertyName.toString(),
            options: validationOptions,
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
                    return 'La contraseña debe tener al menos 8 caracteres, una letra, un número y un carácter especial, y no superar 72 bytes UTF-8.';
                },
            },
        });
    };
}
