import { Module } from '@nestjs/common';

import { AdsService } from './ads.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdRewardChallenge } from './entities/ad-reward-challenge.entity';

@Module({
  imports: [
        TypeOrmModule.forFeature([
            AdRewardChallenge,
        ]),
    ],
    providers: [AdsService],
    exports: [AdsService],
})
export class AdsModule {}