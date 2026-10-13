import type { TransformFnParams } from 'class-transformer';

export function trimString({ value }: TransformFnParams): unknown {
    if (typeof value !== 'string') {
        return value;
    }

    return value.trim();
}