import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, UseGuards, } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { ReadingAccessResponseDto } from './dto/reading-access-response.dto';
import { ReadingService } from './reading.service';
import { RewardChallengeResponseDto } from './dto/reward-challenge-response.dto';
import { RedeemRewardedAdDto } from './dto/redeem-rewarded-ad.dto';
import { ReadingPageResponseDto } from './dto/reading-page-response.dto';
import { ReadingRewardResponseDto } from './dto/reading-reward-response.dto';

@Controller('reading')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER)
export class ReadingController {
  constructor(private readonly readingService: ReadingService) { }

  @Post('books/:bookId/access')
  @HttpCode(HttpStatus.OK)
  startReading(@CurrentUser() currentUser: AuthenticatedUser, @Param('bookId', ParseIntPipe) bookId: number,): Promise<ReadingAccessResponseDto> {
    return this.readingService.startReading(currentUser.userId, bookId);
  }

  @Post('reward-challenge')
  @HttpCode(HttpStatus.OK)
  issueRewardChallenge(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<RewardChallengeResponseDto> {
    return this.readingService.requestRewardedAd(currentUser.userId);
  }


  @Post('reward')
  @HttpCode(HttpStatus.OK)
  redeemRewardedAd(@CurrentUser() currentUser: AuthenticatedUser, @Body() redeemRewardedAdDto: RedeemRewardedAdDto,): Promise<ReadingRewardResponseDto> {
    return this.readingService.redeemRewardedAd(
      currentUser.userId,
      redeemRewardedAdDto.token,
    );
  }

  @Get('books/:bookId/pages/:pageNumber')
  getReadingPage(@CurrentUser() currentUser: AuthenticatedUser, @Param('bookId', ParseIntPipe) bookId: number, @Param('pageNumber', ParseIntPipe) pageNumber: number): Promise<ReadingPageResponseDto> {
    return this.readingService.getReadingPage(currentUser.userId, bookId, pageNumber);
  }
}