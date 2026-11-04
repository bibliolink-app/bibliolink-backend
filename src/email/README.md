# Idioma de los correos de recuperación

## Implementación del backend

`Accept-Language` se resuelve mediante `RequestLanguage` y `resolveLanguage`.
`AuthController.forgotPassword` entrega el `Language` normalizado a
`AuthService.forgotPassword`, que lo pasa explícitamente a
`EmailService.sendPasswordReset`. Se admiten `es`, `en`, `fr` y `pt`; si el
encabezado no está presente o no contiene un idioma soportado, se utiliza `es`.
Los consumidores sin petición HTTP también deben proporcionar un `Language`.

EmailService traduce los textos con `translate` y los diccionarios `email.json`.
El proveedor recibe el asunto y los parámetros ya localizados. No necesita
acceder a una petición HTTP ni guardar un idioma global.

Se conserva la variable `EMAIL_PASSWORD_RESET_TEMPLATE_ID`, sin inventar IDs ni
introducir una plantilla por idioma. `SendTemplateEmailOptions.subject` es
opcional: cuando no se proporciona, Brevo conserva el asunto de la plantilla.

## Configuración externa verificada

El 3 de noviembre de 2026 se consultó mediante GET la plantilla indicada por la
configuración local efectiva. Estaba activa, con asunto y contenido en español,
y utilizaba `{{ params.userName }}`, `{{ params.resetUrl }}` y
`{{ params.currentYear }}`. Esta comprobación no garantiza que otros ambientes
usen la misma plantilla.

Brevo admite parámetros de su New Template Language y permite sobrescribir el
asunto al enviar una plantilla:

- [Referencia de envío](https://developers.brevo.com/reference/send-transac-email)
- [Contenido dinámico](https://developers.brevo.com/docs/send-a-transactional-email)

No se modificó la plantilla externa ni se enviaron correos durante esta fase.
El backend ya envía el asunto traducido. **El cuerpo seguirá en español hasta
que se sustituyan sus textos fijos por los parámetros siguientes en Brevo.**

## Cambios manuales pendientes en Brevo

Abrir la plantilla transaccional correspondiente al ID configurado en cada
ambiente y mantener su diseño, remitente y estado activo. No se necesitan IDs
adicionales. Sustituir los bloques de texto completos, incluidas las partes que
actualmente estén divididas entre etiquetas de formato:

| Ubicación / texto actual | Contenido dinámico |
| --- | --- |
| Texto de vista previa: «Restablece de forma segura…» | `{{ params.preheader }}` |
| Título: «Recuperación de contraseña» | `{{ params.title }}` |
| Saludo: «Hola …,» | `{{ params.greeting }} {{ params.userName }},` |
| Introducción: «Recibimos una solicitud…» | `{{ params.intro }}` |
| Etiqueta del botón: «Restablecer contraseña» | `{{ params.actionLabel }}` |
| Encabezado: «Información de seguridad» | `{{ params.securityTitle }}` |
| Aviso: «Este enlace estará disponible…» | `{{ params.securityNotice }}` |
| Aviso: «Si no solicitaste este cambio…» | `{{ params.ignoreNotice }}` |
| Ayuda: «Si el botón no funciona…» | `{{ params.linkHelp }}` |
| Lema superior: «Historias que te conectan» | `{{ params.brandTagline }}` |
| Lema inferior: «Conecta con tu próxima historia.» | `{{ params.brandClosing }}` |
| «Todos los derechos reservados.» | `{{ params.rightsReserved }}` |
| «Este es un correo automático…» | `{{ params.automatedNotice }}` |
| «Este mensaje fue enviado por BiblioLink…» | `{{ params.securityFooter }}` |

También:

- Si el HTML define un título de documento, usar
  `<title>{{ params.title }} | BiblioLink</title>`.
- Establecer el atributo de idioma del HTML como `lang="{{ params.language }}"`.
- Conservar `{{ params.resetUrl }}` tanto en el destino del botón como en el
  enlace alternativo. No incluir el enlace en otros textos o registros.
- Conservar `© {{ params.currentYear }} BiblioLink.` antes de
  `{{ params.rightsReserved }}`.
- Conservar `userName` como parámetro de texto separado; los textos traducidos
  no contienen nombres, direcciones, tokens ni enlaces interpolados.
- Si el editor tiene una vista previa o versión de texto independiente,
  sustituir allí los mismos textos fijos.
- El asunto se envía en `subject` desde el backend; no necesita un parámetro
  nuevo en la plantilla. El asunto fijo actual puede mantenerse como fallback
  para otros envíos que omitan `subject`.

Los textos nuevos son cadenas de texto, no fragmentos HTML. `language` solo
identifica el idioma normalizado. El nombre BiblioLink y los identificadores de
los parámetros no se traducen.

## Validación posterior

No se ejecutaron pruebas unitarias, de integración ni E2E en esta fase. Después
de configurar la plantilla, comprobar su renderizado en los cuatro idiomas,
incluidos asunto, vista previa, botón, avisos, pie y enlace alternativo. Verificar
que no queden textos fijos en español ni parámetros sin resolver.

La prueba de Auth en `src/auth/auth-i18n.http.spec.ts` actualmente exige tres
argumentos en `sendPasswordReset`. En la validación integral habrá que comprobar
el cuarto argumento, el idioma, conservando las verificaciones de destinatario,
nombre, enlace y respuesta pública. No se modificó esa prueba en esta fase.
