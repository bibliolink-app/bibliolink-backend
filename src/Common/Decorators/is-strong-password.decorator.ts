import {
    registerDecorator,
    ValidationOptions,
} from 'class-validator';

export function IsStrongPassword(
    validationOptions?: ValidationOptions,
): PropertyDecorator {
    return (object: object, propertyName: string | symbol): void => {
        // Crea una validación personalizada que se puede usar en los DTOs.
        registerDecorator({
            name: 'isStrongPassword',
            target: object.constructor,
            propertyName: propertyName.toString(),
            options: validationOptions,
            validator: {
                validate(value: unknown): boolean {
                    // Primero comprueba que el valor recibido sea un texto.
                    if (typeof value !== 'string') {
                        return false;
                    }

                    // Comprueba que la contraseña tenga al menos 8 caracteres.
                    const hasMinimumLength = value.length >= 8;
                    // Comprueba que tenga al menos un número.
                    const hasNumber = /\d/.test(value);
                    // Comprueba que tenga al menos un símbolo especial.
                    const hasSymbol = /[^A-Za-z0-9]/.test(value);

                    // Solo es válida si cumple las tres reglas anteriores.
                    return hasMinimumLength && hasNumber && hasSymbol;
                },

                // Indica qué debe corregirse cuando la contraseña no es válida.
                defaultMessage(
                ): string {
                    return 'La contraseña debe tener al menos 8 caracteres, un número y un símbolo.';
                },
            },
        });
    };
}