import { Inject, Injectable } from '@nestjs/common';

import { envs } from '../config/envs';
import { EMAIL_PROVIDER } from './constants/email.constants';
import type { EmailProvider, SendTemplateEmailOptions, } from './interfaces/email-provider.interface';



@Injectable()
export class EmailService {
    constructor(
        // Obtiene el proveedor de correo configurado sin depender directamente de Brevo.
        @Inject(EMAIL_PROVIDER)
        private readonly emailProvider: EmailProvider,
    ) { }

    // Envía cualquier plantilla mediante el proveedor configurado.
    async sendTemplate(options: SendTemplateEmailOptions): Promise<void> {
        await this.emailProvider.sendTemplate(options);
    }

    // Envía el correo específico para recuperar una contraseña.
    async sendPasswordReset( to: string, userName: string, resetUrl: string, ): Promise<void> {
        await this.sendTemplate({
            to,
            templateId: envs.email.passwordResetTemplateId,
            params: {
                userName,
                resetUrl,
                currentYear: new Date().getFullYear(),
            },
        });
    }

}