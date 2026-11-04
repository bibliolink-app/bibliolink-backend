import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';

import { trimString } from '../../common/transformers/trim-string.transformer';

export class RedeemRewardedAdDto {
    @Transform(trimString)
    @IsString(localizedValidation('VALIDATION_REWARD_TOKEN_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_REWARD_TOKEN_REQUIRED'))
    token!: string;
}
