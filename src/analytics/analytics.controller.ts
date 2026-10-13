import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/enums/user-role.enum';
import type { UserRegistrations } from '../users/interfaces/user-registrations.interface';
import { AnalyticsService } from './analytics.service';
import { AnalyticsSummaryResponseDto } from './dto/analytics-summary-response.dto';
import { RegistrationsQueryDto } from './dto/registrations-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) {}

    @Get('summary')
    getSummary(): Promise<AnalyticsSummaryResponseDto> {
        return this.analyticsService.getSummary();
    }

    @Get('registrations')
    getRegistrationsByPeriod(
        @Query() query: RegistrationsQueryDto,
    ): Promise<UserRegistrations[]> {
        return this.analyticsService.getRegistrationsByPeriod(query.period);
    }
}
