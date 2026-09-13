import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { UsersService } from "./user.service.js";
import { CreateUserDto } from "./dtos/createUser.dto.js";

@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService
    ) { }

    @Get('/all')
    getAllUsers() {
        return this.usersService.getAllUsers();
    }

    @Get('/active')
    getAllActiveUsers() {
        return this.usersService.getAllActiveUsers();
    }

    @Get('/inactive')
    getAllInactiveUsers() {
        return this.usersService.getAllInactiveUsers();
    }

    @Post('/create')
    async createUser(
        @Body() createUserDto: CreateUserDto
    ) {
        return await this.usersService.createUser(createUserDto);
    }

    @Patch('/status/:id')
    async updateUserStatus(
        @Param('id') id: number
    ) {
        return await this.usersService.updateUserStatus(id);
    }
}