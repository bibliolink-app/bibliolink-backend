import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity.js';
import { Repository } from 'typeorm/browser/repository/Repository.js';
import { CreateUserDto } from './dtos/createUser.dto.js';
import * as bcrypt from 'bcrypt';

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
        const RegistereduserName = await this.userRepository.findOne({ where: { userName: createUserDto.userName } });
        if (RegistereduserName) { throw new BadRequestException('This username is already taken, try another one'); }

        const Registeredemail = await this.userRepository.findOne({ where: { email: createUserDto.email } });
        if (Registeredemail) { throw new BadRequestException('This email is already registered, try another one'); }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

        const newUser = this.userRepository.create({
            ...createUserDto,
            password: hashedPassword,
        });

        const savedUser = await this.userRepository.save(newUser);

        const { password, ...userWithoutPassword } = savedUser;
        return userWithoutPassword;
    }

    async updateUserStatus(id: number) {
        const user = await this.userRepository.findOne({ where: { userId: id } });
        if (!user) { throw new BadRequestException('User not found'); }

        user.status = !user.status;
        return await this.userRepository.save(user);
    }
}