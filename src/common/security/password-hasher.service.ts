import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { envs } from '../../config/envs';

@Injectable()
export class PasswordHasherService {
    hash(password: string): Promise<string> {
        return bcrypt.hash(password, envs.passwordHash.rounds);
    }

    verify(password: string, passwordHash: string): Promise<boolean> {
        return bcrypt.compare(password, passwordHash);
    }
}
