import { TransformFnParams } from "class-transformer";

export function trimNullableString({ value, }: TransformFnParams): unknown {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === '' ? null : trimmedValue;
}