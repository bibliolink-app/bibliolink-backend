import { Controller, Get } from "@nestjs/common";
import { UsersService } from "./user.service.js";

@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService
    ) { }

    @Get('/users')
    getAllUsers() {
        return this.usersService.getAllUsers();
    }

    @Get('/users/active')
    getAllActiveUsers() {
        return this.usersService.getAllActiveUsers();
    }

    @Get('/users/inactive')
    getAllInactiveUsers() {
        return this.usersService.getAllInactiveUsers();
    }
}