import { ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { localizedError } from '../i18n/localized-error';
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

import { BookContentFormat } from '../catalogs/enums/book-content-format.enum';
import type { BookReadingSource } from '../books/interfaces/book-reading-source.interface';
import { ReadingContentService } from './content/reading-content.service';
import { ReadingPageResponseDto } from './dto/reading-page-response.dto';



type ReadableBookContentFormat =
  | BookContentFormat.PDF
  | BookContentFormat.EPUB
  | BookContentFormat.HTML
  | BookContentFormat.TEXT;

type ReadableBookSource = Omit<BookReadingSource, 'contentReference' | 'contentFormat'> & {
  contentReference: string;
  contentFormat: ReadableBookContentFormat;
};


@Injectable()
export class ReadingService {
  constructor(
    @InjectRepository(ReadingAccess)
    private readonly readingAccessRepository: Repository<ReadingAccess>,
    private readonly booksService: BooksService,
    private readonly favoritesService: FavoritesService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly adsService: AdsService,
    private readonly readingContentService: ReadingContentService,
  ) { }

  async startReading(userId: number, bookId: number): Promise<ReadingAccessResponseDto> {
    const source = await this.booksService.getReadingSource(bookId);

    this.ensureReadableSource(source);

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
      throw new ConflictException(localizedError('READING_PREMIUM_AD_NOT_REQUIRED'));
    }

    const access = await this.readingAccessRepository.findOne({
      where: { userId },
    });

    if (!access) {
      throw new ConflictException(localizedError('READING_PERIOD_REQUIRED'));
    }

    if (access.expiresAt > new Date()) {
      throw new ConflictException(localizedError('READING_PERIOD_ACTIVE'));
    }

    return this.adsService.issueRewardChallenge(userId);
  }

  async redeemRewardedAd(userId: number, token: string): Promise<ReadingRewardResponseDto> {
    const hasPremiumAccess = await this.subscriptionsService.hasPremiumAccess(userId);

    if (hasPremiumAccess) {
      throw new ConflictException(localizedError('READING_PREMIUM_REWARD_NOT_REQUIRED'));
    }

    return this.readingAccessRepository.manager.transaction(async (manager) => {
      const readingAccessRepository = manager.getRepository(ReadingAccess);

      const access = await readingAccessRepository
        .createQueryBuilder('readingAccess')
        .setLock('pessimistic_write')
        .where('readingAccess.userId = :userId', { userId })
        .getOne();

      if (!access) {
        throw new ConflictException(localizedError('READING_PERIOD_REQUIRED'));
      }

      const now = new Date();

      if (access.expiresAt > now) {
        throw new ConflictException(localizedError('READING_PERIOD_ACTIVE'));
      }

      const consumed = await this.adsService.consumeRewardChallenge(userId, token, manager);

      if (!consumed) {
        throw new ConflictException(localizedError('READING_REWARD_INVALID'));
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

  async getReadingPage(userId: number, bookId: number, pageNumber: number): Promise<ReadingPageResponseDto> {
    const source = await this.getAuthorizedReadingSource(userId, bookId);

    return this.readingContentService.getPage(
      source.contentReference,
      source.contentFormat,
      pageNumber,
    );
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

  private ensureReadableSource(source: BookReadingSource): asserts source is ReadableBookSource {
    if (!source.contentReference || !source.contentFormat) {
      throw new UnprocessableEntityException(localizedError('READING_CONTENT_UNAVAILABLE'));
    }

    if (
      source.contentFormat === BookContentFormat.EXTERNAL_PAGE ||
      source.contentFormat === BookContentFormat.UNSUPPORTED
    ) {
      throw new UnprocessableEntityException(localizedError('READING_CONTENT_FORMAT_UNSUPPORTED'));
    }
  }

  private async getAuthorizedReadingSource(userId: number, bookId: number): Promise<ReadableBookSource> {
    const source = await this.booksService.getReadingSource(bookId);
    this.ensureReadableSource(source);

    const hasPremiumAccess = await this.subscriptionsService.hasPremiumAccess(userId);

    if (!hasPremiumAccess) {
      const access = await this.readingAccessRepository.findOne({
        where: { userId },
      });

      if (!access) {
        throw new ForbiddenException(localizedError('READING_PERIOD_REQUIRED'));
      }

      if (access.expiresAt <= new Date()) {
        throw new ForbiddenException(localizedError('READING_PERIOD_EXPIRED'));
      }
    }
    return source;
  }
}
