import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RegisterDto } from './register.dto';

const payload = {
    username: 'LectorUno',
    firstName: 'María',
    firstSurname: 'López',
    birthDate: '2000-02-29',
    email: 'Reader@example.com',
    password: 'Password1!',
    captchaToken: 'opaque-token',
};

const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
});

function validatePayload(value: unknown): Promise<RegisterDto> {
    return pipe.transform(value, { type: 'body', metatype: RegisterDto });
}

describe('RegisterDto through ValidationPipe', () => {
    it('accepts a valid payload without changing strings', async () => {
        const result = await validatePayload(payload);
        expect(result).toBeInstanceOf(RegisterDto);
        expect(result).toEqual(payload);
        expect(typeof result.birthDate).toBe('string');
    });

    it.each([null, 'María'])('accepts optional names as null or text (%#)', async (value) => {
        const input = { ...payload, middleName: value, secondSurname: value };
        expect(await validatePayload(input)).toEqual(input);
    });

    it('preserves spaces and case without silent normalization', async () => {
        const input = { ...payload, username: ' Reader ', firstName: ' María ', password: ' Password1! ' };
        expect(await validatePayload(input)).toEqual(input);
    });

    it.each([
        'username', 'firstName', 'firstSurname', 'birthDate', 'email', 'password', 'captchaToken',
    ])('rejects a missing required field: %s', async (field) => {
        const input: Record<string, unknown> = { ...payload };
        delete input[field];
        await expect(validatePayload(input)).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
        ['email', 'not-an-email'],
        ['email', 'a'.repeat(245) + '@example.com'],
        ['username', ''], ['username', '   '], ['username', 'a'.repeat(26)],
        ['firstName', ''], ['firstName', '  '], ['firstName', 'a'.repeat(51)],
        ['firstSurname', ''], ['firstSurname', '\t'], ['firstSurname', 'a'.repeat(51)],
        ['middleName', ''], ['middleName', ' '], ['middleName', 'a'.repeat(51)],
        ['secondSurname', ''], ['secondSurname', ' '], ['secondSurname', 'a'.repeat(51)],
        ['birthDate', '29/02/2000'], ['birthDate', '2001-02-29'],
        ['birthDate', '2000-04-31'], ['birthDate', '2000-13-01'],
        ['birthDate', '2000-01-00'], ['birthDate', '2000-01-01T00:00:00Z'],
        ['birthDate', ' 2000-01-01 '], ['birthDate', new Date('2000-01-01')],
        ['captchaToken', ''], ['captchaToken', '   '], ['captchaToken', 'a'.repeat(4097)],
        ['password', 'abcdefgh'], ['password', 'ñ'.repeat(36) + '1!'],
        ['firstName', null], ['username', 123], ['captchaToken', {}],
    ])('rejects invalid %s (%#)', async (field, value) => {
        await expect(validatePayload({ ...payload, [field]: value }))
            .rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts maximum field lengths and a leap date without age restrictions', async () => {
        const input = {
            ...payload,
            username: 'a'.repeat(25),
            firstName: 'a'.repeat(50),
            firstSurname: 'a'.repeat(50),
            middleName: 'a'.repeat(50),
            secondSurname: 'a'.repeat(50),
            email: 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(57) + '.com',
            captchaToken: 'a'.repeat(4096),
            birthDate: '2400-02-29',
        };
        expect(input.email.length).toBe(254);
        expect(await validatePayload(input)).toEqual(input);
    });

    it.each([
        'userId', 'passwordHash', 'role', 'status', 'createdAt', 'updatedAt',
        'premium', 'subscription', 'isAdmin', 'confirmPassword',
    ])('rejects forbidden properties via the pipe: %s', async (field) => {
        await expect(validatePayload({ ...payload, [field]: 'unexpected' }))
            .rejects.toMatchObject({
                response: { message: expect.arrayContaining([`property ${field} should not exist`]) },
            });
    });
});
