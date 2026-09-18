import { Injectable } from '@nestjs/common';
import { BrevoClient } from '@getbrevo/brevo';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { EmailProvider, SendTemplateEmailOptions, } from '../interfaces/email-provider.interface';
import { envs } from '../../config/envs';

@Injectable()
export class BrevoEmailProvider implements EmailProvider {
    private readonly client: BrevoClient;

    constructor(
        @InjectPinoLogger(BrevoEmailProvider.name)
        private readonly logger: PinoLogger,
    ) {
        // Crea el cliente que se comunicará con la API de Brevo.
        this.client = new BrevoClient({
            apiKey: envs.brevo.apiKey,
        });
    }

    // Envía un correo utilizando una plantilla configurada en Brevo.
    async sendTemplate(options: SendTemplateEmailOptions): Promise<void> {
        this.logger.debug('Submitting transactional email to Brevo');
        await this.client.transactionalEmails.sendTransacEmail({
            // Define el remitente configurado para los correos transaccionales.
            sender: {
                name: envs.email.senderName,
                email: envs.email.senderEmail,
            },
            // Define el destinatario del correo.
            to: [
                {
                    email: options.to,
                },
            ],
            // Indica qué plantilla de Brevo debe utilizarse.
            templateId: options.templateId,

            // Envía los valores dinámicos que utiliza la plantilla.
            params: options.params,
        });
        this.logger.debug('Brevo accepted transactional email');
    }
}
