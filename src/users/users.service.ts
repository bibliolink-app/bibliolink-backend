import { BadRequestException, ConflictException, Injectable, NotFoundException, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { PasswordHasherService } from '../common/security/password-hasher.service';

import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListItemResponseDto } from './dto/user-list-item-response.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';
import { isMySqlUniqueViolation } from '../common/databases/is-mysql-unique-violation';

@Injectable()
export class UsersService {
    constructor(
        @InjectPinoLogger(UsersService.name)
        private readonly logger: PinoLogger,
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,

        private readonly passwordHasher: PasswordHasherService,
    ) { }

    findByEmail(email: string): Promise<User | null> {
        this.logger.debug('Looking up user by email');
        return this.usersRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email })
            .getOne();
    }

    findByUsername(username: string): Promise<User | null> {
        this.logger.debug('Looking up user by username');
        return this.usersRepository
            .createQueryBuilder('user')
            .where('user.username = :username', { username })
            .getOne();
    }

    findByIdWithPassword(userId: number): Promise<User | null> {
        this.logger.debug({ userId }, 'Looking up user for credential verification');
        return this.usersRepository
            .createQueryBuilder('user')
            .where('user.userId = :userId', { userId })
            .getOne();
    }

    async updatePassword( userId: number, passwordHash: string, manager?: EntityManager, ): Promise<boolean> {
        this.logger.debug({ userId }, 'Updating user password');
        const repository = manager
            ? manager.getRepository(User)
            : this.usersRepository;

        const result = await repository.update(
            { userId, status: UserStatus.ACTIVE },
            { passwordHash },
        );

        if (result.affected !== 1) {
            this.logger.warn({ userId }, 'Password update rejected: account unavailable');
        } else {
            // Dentro de una transacción, el éxito definitivo se registra después del commit en Auth.
            this.logger.debug({ userId, transactional: Boolean(manager) }, 'Password update statement completed');
        }
        return result.affected === 1;
    }

    async createRegisteredUser(data: {username: string;firstName: string;middleName: string | null;firstSurname: string;secondSurname: string | null;birthDate: string;email: string;passwordHash: string;}): Promise<void> {
        this.logger.debug('Persisting registered user');
        const user = this.usersRepository.create({
            username: data.username,
            firstName: data.firstName,
            middleName: data.middleName,
            firstSurname: data.firstSurname,
            secondSurname: data.secondSurname,
            birthDate: data.birthDate,
            email: data.email,
            passwordHash: data.passwordHash,
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
        });

        try {
            await this.usersRepository.save(user);
            this.logger.info({ userId: user.userId }, 'Registered user created successfully');
        } catch (error: unknown) {
            if (isMySqlUniqueViolation(error)) {
                this.logger.warn('User creation rejected: duplicate account details');
                throw new ConflictException(
                    'El nombre de usuario o el correo electrónico ya está registrado.',
                );
            }
            throw error;
        }
    }

    async create(createAdminDto: CreateAdminDto,): Promise<UserListItemResponseDto> {
        this.logger.debug('Creating administrator');
        const existingEmail = await this.usersRepository
            .createQueryBuilder('user')
            .select(['user.userId'])
            .where('user.email = :email', {
                email: createAdminDto.email,
            })
            .getOne();

        if (existingEmail) {
            this.logger.warn('Administrator creation rejected: duplicate email');
            throw new ConflictException('Ya existe un usuario con este correo electrónico.',);
        }

        const existingUsername = await this.usersRepository
            .createQueryBuilder('user')
            .select(['user.userId'])
            .where('user.username = :username', {
                username: createAdminDto.username,
            })
            .getOne();

        if (existingUsername) {
            this.logger.warn('Administrator creation rejected: duplicate username');
            throw new ConflictException('Ya existe un usuario con este nombre de usuario.',);
        }

        const passwordHash = await this.passwordHasher.hash(
            createAdminDto.password,
        );

        const user = this.usersRepository.create({
            username: createAdminDto.username,
            firstName: createAdminDto.firstName,
            middleName: createAdminDto.middleName ?? null,
            firstSurname: createAdminDto.firstSurname,
            secondSurname: createAdminDto.secondSurname ?? null,
            birthDate: createAdminDto.birthDate,
            email: createAdminDto.email,
            passwordHash,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
        });

        const savedUser = await this.usersRepository.save(user);
        this.logger.info({ userId: savedUser.userId }, 'Administrator created successfully');

        return this.toResponseDto(savedUser);
    }

    async getProfile(userId: number,): Promise<UserProfileResponseDto> {
        this.logger.debug({ userId }, 'Retrieving user profile');
        const user = await this.usersRepository
            .createQueryBuilder('user')
            .select([
                'user.username',
                'user.firstName',
                'user.middleName',
                'user.firstSurname',
                'user.secondSurname',
                'user.birthDate',
                'user.email',
            ])
            .where('user.userId = :userId', { userId })
            .getOne();

        if (!user) {
            this.logger.warn({ userId }, 'Profile lookup rejected: user not found');
            throw new NotFoundException('El usuario no existe.',);
        }

        this.logger.info({ userId }, 'User profile retrieved');
        return {
            username: user.username,
            firstName: user.firstName,
            middleName: user.middleName ?? null,
            firstSurname: user.firstSurname,
            secondSurname: user.secondSurname ?? null,
            birthDate: user.birthDate,
            email: user.email,
        };
    }

    async findAll(): Promise<UserListItemResponseDto[]> {
        this.logger.debug('Retrieving users');
        const users = await this.usersRepository
            .createQueryBuilder('user')
            .select([
                'user.userId',
                'user.username',
                'user.firstName',
                'user.middleName',
                'user.firstSurname',
                'user.secondSurname',
                'user.birthDate',
                'user.email',
                'user.role',
                'user.status',
                'user.createdAt',
            ])
            .orderBy('user.firstName', 'ASC')
            .addOrderBy('user.firstSurname', 'ASC')
            .getMany();

        this.logger.info({ count: users.length }, 'User list retrieved');
        return users.map((user) =>
            this.toResponseDto(user),
        );
    }

    async findById(userId: number,): Promise<UserListItemResponseDto> {
        this.logger.debug({ userId }, 'Looking up user by ID');
        const user = await this.usersRepository
            .createQueryBuilder('user')
            .select([
                'user.userId',
                'user.username',
                'user.firstName',
                'user.middleName',
                'user.firstSurname',
                'user.secondSurname',
                'user.birthDate',
                'user.email',
                'user.role',
                'user.status',
                'user.createdAt',
            ])
            .where('user.userId = :userId', { userId })
            .getOne();

        if (!user) {
            this.logger.warn({ userId }, 'User lookup rejected: user not found');
            throw new NotFoundException(
                'El usuario no existe.',
            );
        }

        return this.toResponseDto(user);
    }

    async update(userId: number, updateUserDto: UpdateUserDto,): Promise<{ message: string }> {
        this.logger.debug({ userId }, 'Updating user');
        const user = await this.usersRepository
            .createQueryBuilder('user')
            .where('user.userId = :userId', { userId })
            .getOne();

        if (!user) {
            this.logger.warn({ userId }, 'User update rejected: user not found');
            throw new NotFoundException('El usuario no existe.',);
        }

        if (updateUserDto.email !== undefined && updateUserDto.email !== user.email) {
            const existingEmail = await this.usersRepository
                .createQueryBuilder('user')
                .select(['user.userId'])
                .where('user.email = :email', {
                    email: updateUserDto.email,
                })
                .andWhere('user.userId != :userId', { userId })
                .getOne();

            if (existingEmail) {
                this.logger.warn({ userId }, 'User update rejected: duplicate email');
                throw new ConflictException('Ya existe un usuario con este correo electrónico.',);
            }

            user.email = updateUserDto.email;
        }

        if (updateUserDto.username !== undefined && updateUserDto.username !== user.username) {
            const existingUsername = await this.usersRepository
                .createQueryBuilder('user')
                .select(['user.userId'])
                .where('user.username = :username', {
                    username: updateUserDto.username,
                })
                .andWhere('user.userId != :userId', { userId })
                .getOne();

            if (existingUsername) {
                this.logger.warn({ userId }, 'User update rejected: duplicate username');
                throw new ConflictException(
                    'Ya existe un usuario con este nombre de usuario.',
                );
            }

            user.username = updateUserDto.username;
        }

        if (updateUserDto.firstName !== undefined) {
            user.firstName = updateUserDto.firstName;
        }

        if (updateUserDto.middleName !== undefined) {
            user.middleName = updateUserDto.middleName;
        }

        if (updateUserDto.firstSurname !== undefined) {
            user.firstSurname = updateUserDto.firstSurname;
        }

        if (updateUserDto.secondSurname !== undefined) {
            user.secondSurname = updateUserDto.secondSurname;
        }

        if (updateUserDto.birthDate !== undefined) {
            user.birthDate = updateUserDto.birthDate;
        }

        await this.usersRepository.save(user);

        this.logger.info({ userId }, 'User updated successfully');
        return {
            message: 'Usuario actualizado correctamente.',
        };
    }

    async disableUser(requesterUserId: number, targetUserId: number,): Promise<{ message: string }> {
        this.logger.debug({ requesterUserId, targetUserId }, 'Disabling user');
        if (requesterUserId === targetUserId) {
            this.logger.warn({ requesterUserId, targetUserId }, 'User disable rejected: self-deactivation');
            throw new BadRequestException(
                'No puedes deshabilitar tu propia cuenta.',
            );
        }

        const user = await this.usersRepository
            .createQueryBuilder('user')
            .where('user.userId = :userId', {
                userId: targetUserId,
            })
            .getOne();

        if (!user) {
            this.logger.warn({ requesterUserId, targetUserId }, 'User disable rejected: user not found');
            throw new NotFoundException('El usuario no existe.',);
        }

        if (user.status !== UserStatus.ACTIVE) {
            this.logger.warn({ requesterUserId, targetUserId }, 'User disable rejected: user already inactive');
            throw new ConflictException('El usuario ya se encuentra inactivo.',);
        }

        user.status = UserStatus.INACTIVE;

        await this.usersRepository.save(user);

        this.logger.info({ requesterUserId, targetUserId }, 'User disabled successfully');
        return {
            message: 'Usuario deshabilitado correctamente.',
        };
    }

    async enableUser(targetUserId: number,): Promise<{ message: string }> {
        this.logger.debug({ targetUserId }, 'Enabling user');
        const user = await this.usersRepository
            .createQueryBuilder('user')
            .where('user.userId = :userId', {
                userId: targetUserId,
            })
            .getOne();

        if (!user) {
            this.logger.warn({ targetUserId }, 'User enable rejected: user not found');
            throw new NotFoundException('El usuario no existe.',);
        }

        if (user.status !== UserStatus.INACTIVE) {
            this.logger.warn({ targetUserId }, 'User enable rejected: user already active');
            throw new ConflictException('El usuario ya se encuentra activo.',);
        }

        user.status = UserStatus.ACTIVE;

        await this.usersRepository.save(user);

        this.logger.info({ targetUserId }, 'User enabled successfully');
        return {
            message: 'Usuario habilitado correctamente.',
        };
    }

    private toResponseDto(user: User,): UserListItemResponseDto {
        return {
            userId: user.userId,
            username: user.username,
            firstName: user.firstName,
            middleName: user.middleName ?? null,
            firstSurname: user.firstSurname,
            secondSurname: user.secondSurname ?? null,
            birthDate: user.birthDate,
            email: user.email,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
        };
    }
}
