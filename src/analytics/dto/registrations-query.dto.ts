import { IsEnum } from 'class-validator';
import { localizedValidation } from '../../i18n/localized-validation';
import { RegistrationPeriod } from '../../users/enums/registration-period.enum';

export class RegistrationsQueryDto {
    @IsEnum(RegistrationPeriod, localizedValidation('VALIDATION_REGISTRATION_PERIOD', {
        values: Object.values(RegistrationPeriod).join(', '),
    }))
    period: RegistrationPeriod;
}
