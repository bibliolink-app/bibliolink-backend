import { Body, Controller, Get, Param, Patch, Post, UseGuards, } from '@nestjs/common';

import type { Language } from '../i18n/i18n.constants';
import { localizedParseIntPipe } from '../i18n/localized-pipes';
import { RequestLanguage } from '../i18n/request-language.decorator';
import { translate } from '../i18n/translate';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListItemResponseDto } from './dto/user-list-item-response.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { UsersService } from './users.service';
import { UserRole } from './enums/user-role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
    ) {}

    @Post('admins')
    @Roles(UserRole.ADMIN)
    createAdmin(
        @Body() createAdminDto: CreateAdminDto,
    ): Promise<UserListItemResponseDto> {
        return this.usersService.create(createAdminDto);
    }

    @Get()
    @Roles(UserRole.ADMIN)
    findAll(): Promise<UserListItemResponseDto[]> {
        return this.usersService.findAll();
    }

    @Get('profile')
    getProfile(
        @CurrentUser() currentUser: AuthenticatedUser,
    ): Promise<UserProfileResponseDto> {
        return this.usersService.getProfile(
            currentUser.userId,
        );
    }

    @Get(':userId')
    @Roles(UserRole.ADMIN)
    findById(
        @Param('userId', localizedParseIntPipe('VALIDATION_USER_ID_INTEGER')) userId: number,
    ): Promise<UserListItemResponseDto> {
        return this.usersService.findById(userId);
    }

    @Patch(':userId')
    @Roles(UserRole.ADMIN)
    async update(
        @Param('userId', localizedParseIntPipe('VALIDATION_USER_ID_INTEGER')) userId: number,
        @Body() updateUserDto: UpdateUserDto,
        @RequestLanguage() language: Language,
    ): Promise<{ message: string }> {
        await this.usersService.update(
            userId,
            updateUserDto,
        );
        return { message: translate('USER_UPDATED', language) };
    }

    @Patch(':userId/enable')
    @Roles(UserRole.ADMIN)
    async enableUser(
        @Param('userId', localizedParseIntPipe('VALIDATION_USER_ID_INTEGER')) userId: number,
        @RequestLanguage() language: Language,
    ): Promise<{ message: string }> {
        await this.usersService.enableUser(userId);
        return { message: translate('USER_ENABLED', language) };
    }

    @Patch(':userId/disable')
    @Roles(UserRole.ADMIN)
    async disableUser(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Param('userId', localizedParseIntPipe('VALIDATION_USER_ID_INTEGER')) targetUserId: number,
        @RequestLanguage() language: Language,
    ): Promise<{ message: string }> {
        await this.usersService.disableUser(
            currentUser.userId,
            targetUserId,
        );
        return { message: translate('USER_DISABLED', language) };
    }
}
