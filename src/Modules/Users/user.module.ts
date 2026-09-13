import { Module } from "@nestjs/common";
import { UsersController } from "./user.controller.js";
import { UsersService } from "./user.service.js";
import { User } from "./user.entity.js";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
    imports: [TypeOrmModule.forFeature([User])],
    controllers: [UsersController],
    providers: [UsersService],
})

export class UsersModule {}