import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BooksService } from '../books/books.service';
import { isMySqlUniqueViolation } from '../common/databases/is-mysql-unique-violation';
import { FavoritesService } from '../favorites/favorites.service';
import { Membership } from '../subscriptions/enums/membership.enum';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { envs } from '../config/envs';
import { ReadingAccessResponseDto } from './dto/reading-access-response.dto';
import { ReadingAccess } from './entities/reading-access.entity';
import { AdsService } from '../ads/ads.service';
import { RewardChallengeResponseDto } from './dto/reward-challenge-response.dto';
import { ReadingRewardResponseDto } from './dto/reading-reward-response.dto';

@Injectable()
export class ReadingService {
  constructor(
    @InjectRepository(ReadingAccess)
    private readonly readingAccessRepository: Repository<ReadingAccess>,
    private readonly booksService: BooksService,
    private readonly favoritesService: FavoritesService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly adsService: AdsService,
  ) { }

  async startReading(userId: number, bookId: number): Promise<ReadingAccessResponseDto> {
    await this.booksService.findOne(bookId);

    const [hasPremiumAccess, readingState] = await Promise.all([
      this.subscriptionsService.hasPremiumAccess(userId),
      this.favoritesService.findReadingState(userId, bookId),
    ]);

    const now = new Date();

    if (hasPremiumAccess) {
      return {
        membership: Membership.PREMIUM,
        canRead: true,
        requiresReward: false,
        expiresAt: null,
        serverTime: now,
        readingState,
      };
    }

    const access = await this.findOrCreateFreeAccess(userId, now);
    const canRead = access.expiresAt > now;

    return {
      membership: Membership.FREE,
      canRead,
      requiresReward: !canRead,
      expiresAt: access.expiresAt,
      serverTime: now,
      readingState,
    };
  }

  async requestRewardedAd(userId: number): Promise<RewardChallengeResponseDto> {
    const hasPremiumAccess = await this.subscriptionsService.hasPremiumAccess(userId);

    if (hasPremiumAccess) {
      throw new ConflictException('Los usuarios Premium no requieren anuncios para continuar leyendo.');
    }

    const access = await this.readingAccessRepository.findOne({
      where: { userId },
    });

    if (!access) {
      throw new ConflictException('Primero debe iniciar un periodo de lectura.');
    }

    if (access.expiresAt > new Date()) {
      throw new ConflictException('El periodo de lectura actual todavía está vigente.');
    }

    return this.adsService.issueRewardChallenge(userId);
  }

async redeemRewardedAd(userId: number, token: string): Promise<ReadingRewardResponseDto> {
    const hasPremiumAccess = await this.subscriptionsService.hasPremiumAccess(userId);

    if (hasPremiumAccess) {
        throw new ConflictException('Los usuarios Premium no requieren recompensas para continuar leyendo.');
    }

    return this.readingAccessRepository.manager.transaction(async (manager) => {
        const readingAccessRepository = manager.getRepository(ReadingAccess);

        const access = await readingAccessRepository
            .createQueryBuilder('readingAccess')
            .setLock('pessimistic_write')
            .where('readingAccess.userId = :userId', { userId })
            .getOne();

        if (!access) {
            throw new ConflictException('Primero debe iniciar un periodo de lectura.');
        }

        const now = new Date();

        if (access.expiresAt > now) {
            throw new ConflictException('El periodo de lectura actual todavía está vigente.');
        }

        const consumed = await this.adsService.consumeRewardChallenge(userId, token, manager);

        if (!consumed) {
            throw new ConflictException('La recompensa no es válida, expiró o ya fue utilizada.');
        }

        access.expiresAt = new Date(now.getTime() + envs.reading.freePeriodMs);

        await readingAccessRepository.save(access);

        return {
            canRead: true,
            expiresAt: access.expiresAt,
            serverTime: now,
        };
    });
}



  private async findOrCreateFreeAccess(userId: number, now: Date): Promise<ReadingAccess> {
    const existingAccess = await this.readingAccessRepository.findOne({
      where: { userId },
    });

    if (existingAccess) {
      return existingAccess;
    }

    const access = this.readingAccessRepository.create({
      userId,
      expiresAt: new Date(now.getTime() + envs.reading.freePeriodMs),
    });

    try {
      return await this.readingAccessRepository.save(access);
    } catch (error: unknown) {
      if (!isMySqlUniqueViolation(error)) {
        throw error;
      }

      const concurrentAccess = await this.readingAccessRepository.findOne({
        where: { userId },
      });

      if (!concurrentAccess) {
        throw error;
      }

      return concurrentAccess;
    }
  }
}