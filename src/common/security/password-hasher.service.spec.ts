import { getRounds } from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { envs } from '../../config/envs';
import { PasswordHasherService } from './password-hasher.service';

const passwordHashConfig = vi.hoisted(() => ({ rounds: 10 }));

vi.mock('../../config/envs', () => ({
    envs: { passwordHash: passwordHashConfig },
}));

describe('PasswordHasherService', () => {
    const service = new PasswordHasherService();

    beforeEach(() => {
        passwordHashConfig.rounds = 10;
    });

    it('generates a hash distinct from the input that verifies correctly', async () => {
        const password = 'Example-password-42';
        const hash = await service.hash(password);

        expect(hash).not.toBe(password);
        await expect(service.verify(password, hash)).resolves.toBe(true);
        await expect(service.verify('Incorrect-password', hash)).resolves.toBe(false);
    });

    it('generates independently salted hashes for the same password', async () => {
        const password = 'Example-password-42';
        const first = await service.hash(password);
        const second = await service.hash(password);

        expect(first).not.toBe(second);
        await expect(service.verify(password, first)).resolves.toBe(true);
        await expect(service.verify(password, second)).resolves.toBe(true);
    });

    it('uses the configured cost and verifies hashes created with an earlier cost', async () => {
        const password = 'Example-password-42';
        const original = await service.hash(password);
        expect(getRounds(original)).toBe(envs.passwordHash.rounds);

        passwordHashConfig.rounds = 11;
        const updated = await service.hash(password);

        expect(getRounds(updated)).toBe(11);
        await expect(service.verify(password, original)).resolves.toBe(true);
        await expect(service.verify(password, updated)).resolves.toBe(true);
    });

    it.each(['', 'a', '  texto con espacios ñ  '])(
        'does not impose complexity rules or normalize input (%#)',
        async (password) => {
            const hash = await service.hash(password);

            await expect(service.verify(password, hash)).resolves.toBe(true);
            await expect(service.verify(`${password}!`, hash)).resolves.toBe(false);
        },
    );
});
