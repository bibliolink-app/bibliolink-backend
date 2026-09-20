import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { PasswordHasherService } from '../common/security/password-hasher.service';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';

@Injectable()
export class SeedService {
    constructor(
        @InjectPinoLogger(SeedService.name)
        private readonly logger: PinoLogger,

        private readonly configService: ConfigService,

        private readonly dataSource: DataSource,

        private readonly passwordHasherService: PasswordHasherService,
    ) { }

    // Crea los datos mínimos que el sistema necesita para comenzar a usarse.
    async run(): Promise<void> {
        // Obtiene de las variables de entorno el correo del Root_admin inicial.
        const email =
            this.configService.getOrThrow<string>(
                'ROOT_ADMIN_EMAIL',
            );

        const userRepository =
            this.dataSource.getRepository(User);

        // Revisa si el usuario inicial ya existe para evitar duplicarlo.
        const existingUser = await userRepository.findOne({
            where: { email },
        });

        if (existingUser) {
            this.logger.info(
                { userId: existingUser.userId },
                'El administrador raíz inicial ya existe. No se realizarán cambios.',
            );

            return;
        }

        // Obtiene la contraseña inicial desde las variables de entorno.
        const password =
            this.configService.getOrThrow<string>(
                'ROOT_ADMIN_PASSWORD',
            );

        // Protege la contraseña antes de almacenarla.
        const hashedPassword =
            await this.passwordHasherService.hash(password);

        // Construye el usuario inicial utilizando directamente
        // el rol ADMIN definido por el sistema.
        const user = userRepository.create({
            role: UserRole.ADMIN,

            // El administrador raíz debe quedar disponible desde el primer arranque.
            status: UserStatus.ACTIVE,

            username:
                this.configService.getOrThrow<string>(
                    'ROOT_ADMIN_USERNAME',
                ),

            firstName:
                this.configService.getOrThrow<string>(
                    'ROOT_ADMIN_FIRST_NAME',
                ),

            middleName:
                this.configService.get<string>(
                    'ROOT_ADMIN_MIDDLE_NAME',
                ) || null,

            firstSurname:
                this.configService.getOrThrow<string>(
                    'ROOT_ADMIN_FIRST_SURNAME',
                ),

            secondSurname:
                this.configService.get<string>(
                    'ROOT_ADMIN_SECOND_SURNAME',
                ) || null,

            email,

            passwordHash: hashedPassword,

            birthDate:
                this.configService.getOrThrow<string>(
                    'ROOT_ADMIN_BIRTH_DATE',
                ),
        });

        // Guarda el administrador raíz y obtiene su identificador generado.
        const savedUser =
            await userRepository.save(user);

        this.logger.info(
            { userId: savedUser.userId },
            'Administrador raíz inicial creado correctamente.',
        );
    }
}
