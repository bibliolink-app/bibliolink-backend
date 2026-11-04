// Define los datos necesarios para enviar un correo basado en una plantilla.
export interface SendTemplateEmailOptions {
    // Dirección de correo del destinatario.
    to: string;

    // Identifica la plantilla que debe utilizar el proveedor de correo.
    templateId: number;

    // Si se omite, se conserva el asunto definido en la plantilla.
    subject?: string;

    // Valores dinámicos que se insertarán dentro de la plantilla.
    params: Record<string, unknown>;
}

// Define las operaciones que debe implementar cualquier proveedor de correo.
export interface EmailProvider {
    // Envía un correo utilizando una plantilla y sus valores dinámicos.
    sendTemplate(options: SendTemplateEmailOptions): Promise<void>;
}
