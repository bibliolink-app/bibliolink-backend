import { IsEnum } from 'class-validator';
import { RegistrationPeriod } from '../../users/enums/registration-period.enum';

export class RegistrationsQueryDto {
    @IsEnum(RegistrationPeriod)
    period: RegistrationPeriod;
}
