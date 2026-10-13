import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { IsStrongPassword } from './is-strong-password.decorator';

class PasswordDto {
    @IsStrongPassword()
    password: unknown;
}

describe('IsStrongPassword', () => {
    it.each([
        'Abcdef1!', 'abcdef1!', 'ññññññ1!', 'Abcdef١!',
        'a'.repeat(70) + '1!', 'ñ'.repeat(35) + '1!',
        '  abcde1!  ',
    ])('accepts compliant input (%#)', async (password) => {
        const dto = new PasswordDto();
        dto.password = password;
        expect(await validate(dto)).toEqual([]);
        expect(dto.password).toBe(password);
    });

    it.each([
        'Ab1!', '1234567!', 'Abcdefg!', 'Abcdefg1',
        'abcdef1 ', 'ññññññ12', '😀😀😀a1!',
        'a'.repeat(71) + '1!', 'ñ'.repeat(36) + '1!',
        '', null, undefined, 12345678, {},
    ])('rejects invalid input with a safe message (%#)', async (password) => {
        const dto = new PasswordDto();
        dto.password = password;
        const errors = await validate(dto);
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints).toEqual({
            isStrongPassword: 'La contraseña debe tener al menos 8 caracteres, una letra, un número y un carácter especial, y no superar 72 bytes UTF-8.',
        });
    });

    it('rejects multibyte input below 72 characters but above 72 bytes', async () => {
        const dto = new PasswordDto();
        const password = 'ñ'.repeat(36) + '1!';
        expect(password.length).toBeLessThan(72);
        expect(Buffer.byteLength(password, 'utf8')).toBeGreaterThan(72);
        dto.password = password;
        expect(await validate(dto)).toHaveLength(1);
    });
});
