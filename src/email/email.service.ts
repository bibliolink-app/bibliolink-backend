import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { envs } from '../config/envs';
import type { Language } from '../i18n/i18n.constants';
import { translate } from '../i18n/translate';
import { EMAIL_PROVIDER } from './constants/email.constants';
import type { EmailProvider, SendTemplateEmailOptions, } from './interfaces/email-provider.interface';



@Injectable()
export class EmailService {
    constructor(
        @InjectPinoLogger(EmailService.name)
        private readonly logger: PinoLogger,
        // Obtiene el proveedor de correo configurado sin depender directamente de Brevo.
        @Inject(EMAIL_PROVIDER)
        private readonly emailProvider: EmailProvider,
    ) { }

    // Envía cualquier plantilla mediante el proveedor configurado.
    async sendTemplate(options: SendTemplateEmailOptions): Promise<void> {
        this.logger.debug('Sending template email');
        await this.emailProvider.sendTemplate(options);
        this.logger.info('Template email sent successfully');
    }

    // Envía el correo específico para recuperar una contraseña.
    async sendPasswordReset( to: string, userName: string, resetUrl: string, language: Language ): Promise<void> {
        this.logger.debug('Preparing password recovery email');
        await this.sendTemplate({
            to,
            templateId: envs.email.passwordResetTemplateId,
            subject: translate('EMAIL_PASSWORD_RESET_SUBJECT', language),
            params: {
                userName,
                resetUrl,
                currentYear: new Date().getFullYear(),
                // Contrato de la plantilla externa: ver README.md de este módulo.
                language,
                preheader: translate('EMAIL_PASSWORD_RESET_PREHEADER', language),
                title: translate('EMAIL_PASSWORD_RESET_TITLE', language),
                greeting: translate('EMAIL_PASSWORD_RESET_GREETING', language),
                intro: translate('EMAIL_PASSWORD_RESET_INTRO', language),
                actionLabel: translate('EMAIL_PASSWORD_RESET_ACTION', language),
                securityTitle: translate('EMAIL_PASSWORD_RESET_SECURITY_TITLE', language),
                securityNotice: translate('EMAIL_PASSWORD_RESET_SECURITY_NOTICE', language),
                ignoreNotice: translate('EMAIL_PASSWORD_RESET_IGNORE_NOTICE', language),
                linkHelp: translate('EMAIL_PASSWORD_RESET_LINK_HELP', language),
                brandTagline: translate('EMAIL_BRAND_TAGLINE', language),
                brandClosing: translate('EMAIL_BRAND_CLOSING', language),
                rightsReserved: translate('EMAIL_RIGHTS_RESERVED', language),
                automatedNotice: translate('EMAIL_AUTOMATED_NOTICE', language),
                securityFooter: translate('EMAIL_SECURITY_FOOTER', language),
            },
        });
    }

}
