import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecurityModule } from '../common/security/security.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        SecurityModule,
        PassportModule.register({
            session: false,
        }),
    ],
    controllers: [UsersController],
    providers: [
        UsersService,
        JwtAuthGuard,
        RolesGuard,
    ],
    exports: [UsersService],
})
export class UsersModule {}