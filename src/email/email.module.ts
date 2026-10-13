import { Module } from '@nestjs/common';

import { EMAIL_PROVIDER } from './constants/email.constants';
import { EmailService } from './email.service';
import { BrevoEmailProvider } from './providers/brevo-email.provider';

@Module({
    providers: [
        // Servicio que utilizará el resto de la aplicación para enviar correos.
        EmailService,

        // Implementación concreta que sabe comunicarse con Brevo.
        BrevoEmailProvider,

        {
            // Relaciona el contrato genérico con la implementación actual.
            provide: EMAIL_PROVIDER,

            // Cuando se solicite EMAIL_PROVIDER, Nest reutiliza BrevoEmailProvider.
            useExisting: BrevoEmailProvider,
        },
    ],

    // Permite que otros módulos utilicen EmailService.
    exports: [EmailService],
})
export class EmailModule { }