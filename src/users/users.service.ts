import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    findById(userId: number): Promise<User | null> {
        return this.userRepository.findOneBy({ userId });
    }

    findByEmail(email: string): Promise<User | null> {
        return this.userRepository.findOneBy({ email });
    }

    findByUsername(username: string): Promise<User | null> {
        return this.userRepository.findOneBy({ username });
    }
}
