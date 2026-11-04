import { IsInt, IsNotEmpty, IsString, MaxLength, Min, } from 'class-validator';

import { localizedValidation } from '../../i18n/localized-validation';

export class ConfirmSubscriptionDto {
    @IsInt(localizedValidation('VALIDATION_SUBSCRIPTION_ID_INTEGER'))
    @Min(1, localizedValidation('VALIDATION_SUBSCRIPTION_ID_MIN', { min: 1 }))
    subscriptionId!: number;

    @IsString(localizedValidation('VALIDATION_REFERENCE_STRING'))
    @IsNotEmpty(localizedValidation('VALIDATION_REFERENCE_REQUIRED'))
    @MaxLength(255, localizedValidation('VALIDATION_REFERENCE_MAX_LENGTH', { max: 255 }))
    externalSubscriptionReference!: string;
}
