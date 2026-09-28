import 'reflect-metadata';
import 'dotenv/config';

import { randomUUID } from 'node:crypto';

import { DataSource } from 'typeorm';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { User } from '../users/entities/user.entity';
import { AdsService } from './ads.service';
import { AdRewardChallenge } from './entities/ad-reward-challenge.entity';

describe.skipIf(process.env.ADS_MYSQL_TESTS !== '1')(
    'Ads MySQL integration',
    () => {
        let source: DataSource;
        let service: AdsService;

        const prefix =
            `ads_test_${randomUUID().replaceAll('-', '')}_`;

        const challengesTable =
            `\`${prefix}ad_reward_challenges\``;

        beforeAll(async () => {
            source = new DataSource({
                type: 'mysql',
                host: process.env.DATABASE_HOST,
                port: Number(process.env.DATABASE_PORT ?? 3306),
                username: process.env.DATABASE_USER,
                password: process.env.DATABASE_PASSWORD,
                database: process.env.DATABASE_NAME,

                timezone: 'Z',
                dateStrings: false,

                entities: [
                    User,
                    AdRewardChallenge,
                ],

                synchronize: false,
                migrationsRun: false,

                entityPrefix: prefix,

                // Las tablas TEMPORARY pertenecen a una conexión.
                extra: {
                    connectionLimit: 1,
                },
            });

            await source.initialize();

            await source.query(`
        CREATE TEMPORARY TABLE ${challengesTable} (
          ad_reward_challenge_id INT UNSIGNED
            AUTO_INCREMENT PRIMARY KEY,

          user_id INT UNSIGNED NOT NULL UNIQUE,

          token_hash CHAR(64) NOT NULL UNIQUE,

          expires_at DATETIME(3) NOT NULL,

          consumed_at DATETIME(3) NULL,

          created_at DATETIME(3)
            NOT NULL
            DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB
      `);

            service = new AdsService(
                source.getRepository(AdRewardChallenge),
            );
        });

        beforeEach(async () => {
            await source.query(
                `DELETE FROM ${challengesTable}`,
            );
        });

        afterAll(async () => {
            if (source?.isInitialized) {
                await source.destroy();
            }
        });

        it(
            'replaces the previous challenge for the same user',
            async () => {
                const userId = 25;

                const first =
                    await service.issueRewardChallenge(userId);

                const second =
                    await service.issueRewardChallenge(userId);

                expect(first.token).not.toBe(second.token);

                expect(
                    await service.consumeRewardChallenge(
                        userId,
                        first.token,
                    ),
                ).toBe(false);

                expect(
                    await service.consumeRewardChallenge(
                        userId,
                        second.token,
                    ),
                ).toBe(true);
            },
        );

        it(
            'does not allow the same challenge to be consumed twice',
            async () => {
                const userId = 25;

                const challenge =
                    await service.issueRewardChallenge(userId);

                expect(
                    await service.consumeRewardChallenge(
                        userId,
                        challenge.token,
                    ),
                ).toBe(true);

                expect(
                    await service.consumeRewardChallenge(
                        userId,
                        challenge.token,
                    ),
                ).toBe(false);
            },
        );

        it(
            'does not allow another user to consume the challenge',
            async () => {
                const ownerUserId = 25;
                const otherUserId = 30;

                const challenge =
                    await service.issueRewardChallenge(
                        ownerUserId,
                    );

                expect(
                    await service.consumeRewardChallenge(
                        otherUserId,
                        challenge.token,
                    ),
                ).toBe(false);

                // El intento del otro usuario no lo consume.
                expect(
                    await service.consumeRewardChallenge(
                        ownerUserId,
                        challenge.token,
                    ),
                ).toBe(true);
            },
        );

        it(
            'rejects an expired challenge',
            async () => {
                const userId = 25;

                const challenge =
                    await service.issueRewardChallenge(userId);

                await source.query(
                    `
            UPDATE ${challengesTable}
            SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND)
            WHERE user_id = ?`,
                    [userId],
                );

                expect(
                    await service.consumeRewardChallenge(
                        userId,
                        challenge.token,
                    ),
                ).toBe(false);
            },
        );
    },
);