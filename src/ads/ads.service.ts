import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, MoreThan, Repository, } from 'typeorm';

import { AdRewardChallenge } from './entities/ad-reward-challenge.entity';
import { IssuedRewardChallenge } from './interfaces/issued-reward-challenge.interface';

@Injectable()
export class AdsService {
  private static readonly REWARD_CHALLENGE_TTL_MS = 5 * 60_000;

  constructor(
    @InjectRepository(AdRewardChallenge)
    private readonly rewardChallengeRepository: Repository<AdRewardChallenge>,
  ) { }

  async issueRewardChallenge(userId: number,): Promise<IssuedRewardChallenge> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + AdsService.REWARD_CHALLENGE_TTL_MS,
    );

    const tokenHash = this.hashToken(token);

    await this.rewardChallengeRepository.upsert(
      {
        userId,
        tokenHash,
        expiresAt,
        consumedAt: null,
      },
      {
        conflictPaths: ['userId'],
      },
    );

    return {
      token,
      expiresAt,
    };
  }

  async consumeRewardChallenge(userId: number, token: string, manager?: EntityManager,): Promise<boolean> {
    const repository = manager
      ? manager.getRepository(AdRewardChallenge)
      : this.rewardChallengeRepository;

    const now = new Date();

    const result = await repository.update(
      {
        userId,
        tokenHash: this.hashToken(token),
        consumedAt: IsNull(),
        expiresAt: MoreThan(now),
      },
      {
        consumedAt: now,
      },
    );

    return result.affected === 1;
  }

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }
}