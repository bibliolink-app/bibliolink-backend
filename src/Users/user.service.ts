import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity.js';
import { Repository } from 'typeorm/browser/repository/Repository.js';
import { CreateUserDto } from './dtos/createUser.dto.js';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) { }

    async getAllUsers(): Promise<User[]> {
        return await this.userRepository.find();
    }

    async getAllActiveUsers(): Promise<User[]> {
        return await this.userRepository.find({ where: { status: true } });
    }

    async getAllInactiveUsers(): Promise<User[]> {
        return await this.userRepository.find({ where: { status: false } });
    }

    async createUser(createUserDto: CreateUserDto) {
        const user = this.userRepository.create(createUserDto);
        return await this.userRepository.save(user);
    }
}