import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersService } from '../users/users.service';
import type { UserRegistrations, } from '../users/interfaces/user-registrations.interface';
import { AnalyticsSummaryResponseDto } from './dto/analytics-summary-response.dto';
import { RegistrationPeriod } from '../users/enums/registration-period.enum';

@Injectable()
export class AnalyticsService {
    constructor(
        private readonly usersService: UsersService,
        private readonly subscriptionsService: SubscriptionsService,
        private readonly dataSource: DataSource,
    ) {}

    getSummary(): Promise<AnalyticsSummaryResponseDto> {
        // Ambos conteos deben observar la misma población ante altas o cambios de rol concurrentes.
        return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
            const totalUsers = await this.usersService.countRegisteredUsers(manager);
            const premiumUsers = await this.subscriptionsService.countActiveSubscribers(manager);
            return { totalUsers, premiumUsers, freeUsers: totalUsers - premiumUsers };
        });
    }

    getRegistrationsByPeriod(period: RegistrationPeriod): Promise<UserRegistrations[]> {
        return this.usersService.getRegistrationsByPeriod(period);
    }
}
