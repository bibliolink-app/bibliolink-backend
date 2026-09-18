import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards, } from '@nestjs/common';

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
        @Param('userId', ParseIntPipe) userId: number,
    ): Promise<UserListItemResponseDto> {
        return this.usersService.findById(userId);
    }

    @Patch(':userId')
    @Roles(UserRole.ADMIN)
    update(
        @Param('userId', ParseIntPipe) userId: number,
        @Body() updateUserDto: UpdateUserDto,
    ): Promise<{ message: string }> {
        return this.usersService.update(
            userId,
            updateUserDto,
        );
    }

    @Patch(':userId/enable')
    @Roles(UserRole.ADMIN)
    enableUser(
        @Param('userId', ParseIntPipe) userId: number,
    ): Promise<{ message: string }> {
        return this.usersService.enableUser(userId);
    }

    @Patch(':userId/disable')
    @Roles(UserRole.ADMIN)
    disableUser(
        @CurrentUser() currentUser: AuthenticatedUser,
        @Param('userId', ParseIntPipe) targetUserId: number,
    ): Promise<{ message: string }> {
        return this.usersService.disableUser(
            currentUser.userId,
            targetUserId,
        );
    }
}
