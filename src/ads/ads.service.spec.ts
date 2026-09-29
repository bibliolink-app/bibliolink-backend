import { createHash } from 'node:crypto';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InsertResult, Repository, UpdateResult, } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi, type Mocked, } from 'vitest';
import { AdsService } from './ads.service';
import { AdRewardChallenge } from './entities/ad-reward-challenge.entity';

describe('AdsService', () => {
    let service: AdsService;
    let repository: Mocked<Repository<AdRewardChallenge>>;

    const userId = 25;

    beforeEach(async () => {
        const repositoryMock = {
            upsert: vi.fn(),
            update: vi.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdsService,
                {
                    provide: getRepositoryToken(AdRewardChallenge),
                    useValue: repositoryMock,
                },
            ],
        }).compile();

        service = module.get(AdsService);
        repository = module.get(getRepositoryToken(AdRewardChallenge));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('issueRewardChallenge', () => {
        it('should issue and persist a reward challenge', async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-09-27T20:00:00.000Z'));

            repository.upsert.mockResolvedValue({} as InsertResult);

            const result = await service.issueRewardChallenge(userId);

            const expectedHash = createHash('sha256')
                .update(result.token)
                .digest('hex');

            expect(result.token).toBeDefined();
            expect(result.expiresAt).toEqual(
                new Date('2026-09-27T20:05:00.000Z'),
            );

            expect(repository.upsert).toHaveBeenCalledWith(
                {
                    userId,
                    tokenHash: expectedHash,
                    expiresAt: result.expiresAt,
                    consumedAt: null,
                },
                {
                    conflictPaths: ['userId'],
                },
            );
        });

        it('should not persist the raw token', async () => {
            repository.upsert.mockResolvedValue({} as InsertResult);

            const result = await service.issueRewardChallenge(userId);

            const expectedHash = createHash('sha256')
                .update(result.token)
                .digest('hex');

            expect(repository.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId,
                    tokenHash: expectedHash,
                    consumedAt: null,
                }),
                {
                    conflictPaths: ['userId'],
                },
            );

            expect(expectedHash).not.toBe(result.token);
        });
    });

    describe('consumeRewardChallenge', () => {
        it('should return true when the challenge is consumed', async () => {
            repository.update.mockResolvedValue({
                affected: 1,
            } as UpdateResult);

            const result = await service.consumeRewardChallenge(
                userId,
                'valid-token',
            );

            expect(result).toBe(true);
            expect(repository.update).toHaveBeenCalledTimes(1);
        });

        it('should return false when no valid challenge is found', async () => {
            repository.update.mockResolvedValue({
                affected: 0,
            } as UpdateResult);

            const result = await service.consumeRewardChallenge(
                userId,
                'invalid-token',
            );

            expect(result).toBe(false);
        });

        it('should hash the received token before querying the database', async () => {
            repository.update.mockResolvedValue({
                affected: 1,
            } as UpdateResult);

            const token = 'reward-token';

            await service.consumeRewardChallenge(userId, token);

            const expectedHash = createHash('sha256')
                .update(token)
                .digest('hex');

            const criteria = repository.update.mock.calls[0][0];

            expect(criteria).toEqual(
                expect.objectContaining({
                    userId,
                    tokenHash: expectedHash,
                }),
            );
        });
    });
});