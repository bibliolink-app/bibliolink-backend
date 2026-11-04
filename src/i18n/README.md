# Cierre de internacionalización del backend

Revisión estática de la fase 9 realizada el 3 de noviembre de 2026. Idiomas:
español (`es`), inglés (`en`), francés (`fr`) y portugués (`pt`).

## Alcance y resultado

Se revisaron las excepciones HTTP, validaciones y respuestas con texto de
`common`, `auth`, `users`, `email`, `captcha`, `analytics`, `reading` y
`subscriptions`. No se encontraron nuevos mensajes públicos propios pendientes
de localizar en estos módulos. Se conservaron las implementaciones de las
fases anteriores; esta fase no agrega claves ni cambia código ejecutable.

La revisión adicional de los módulos condicionados por su exposición HTTP dio
el siguiente resultado:

| Módulo | Resultado |
| --- | --- |
| `payment_transactions` | El controller no declara endpoints. El servicio se utiliza desde suscripciones; el error de inconsistencia de un pago es un `Error` interno y el filtro global presenta `INTERNAL_ERROR`, sin exponer su texto técnico. |
| `ads` | No tiene controller ni mensajes HTTP propios. Devuelve datos del desafío o un booleano; el rechazo público de recompensa pertenece a `reading` y ya está localizado. |
| `seed` | No tiene controller. Sus mensajes son logs operativos; no se traducen ni se ejecutó el seed. |

Las excepciones públicas utilizan `localizedError`; las validaciones utilizan
`localizedValidation` y los pipes localizados existentes. Las respuestas con
mensajes de éxito utilizan `RequestLanguage` y `translate`.
`HttpExceptionFilter` conserva la negociación mediante `Accept-Language`, los
mensajes específicos y la forma de la respuesta. Los errores internos se
presentan con `INTERNAL_ERROR` cuando llegan al filtro sin ser excepciones HTTP.

Los rechazos predeterminados de autenticación, permisos y throttling están
cubiertos por `AUTH_UNAUTHORIZED`, `AUTH_FORBIDDEN` y `REQUEST_RATE_LIMITED`.
Los valores técnicos de `error`, los enums, nombres de propiedades y eventos
SSE, datos de usuarios y contenido de libros no se traducen.

## Limitación conocida: 404 de rutas inexistentes

Se inspeccionó el código instalado de NestJS:

- `node_modules/@nestjs/core/router/routes-resolver.js`, método
  `RoutesResolver.registerNotFoundHandler`.
- `node_modules/@nestjs/common/exceptions/not-found.exception.js`.

Nest registra un handler en el adaptador HTTP que construye:

```ts
new NotFoundException(`Cannot ${method} ${url}`);
```

La excepción no incluye un código de origen específico, una causa ni una clase
distinta que permita identificar con certeza una ruta inexistente frente a un
404 explícito con mensaje de un módulo o middleware.

El filtro existente conserva ese mensaje y devuelve `code: null`, HTTP 404 y
la estructura habitual. Los 404 de los módulos que ya llevan un código i18n
continúan traduciéndose sin cambios.

No se implementó una normalización basada en HTTP 404, comparación del texto,
stack trace o ausencia de `request.route`: esas señales no ofrecen una
distinción segura entre todos los posibles orígenes. Una solución con origen
explícito requeriría intervenir en el handler de rutas inexistentes o en el
adaptador/enrutamiento, lo que está excluido en esta fase. Por ello, el 404
automático queda documentado como limitación conocida.

## Limitación externa: cuerpo del correo en Brevo

El backend ya entrega el asunto y los parámetros traducidos. La plantilla
externa revisada durante la fase Email conserva textos fijos en español hasta
que se apliquen manualmente las sustituciones documentadas en
[Email](../email/README.md). No se consultó ni modificó Brevo en esta fase.

## Alcance de la verificación

La revisión estática no reemplaza la validación integral de comportamiento y
mensajes HTTP. En esta fase solo se ejecutan build, lint y `git diff --check`;
no se ejecutan ni modifican pruebas unitarias, de integración o E2E.
Los pendientes de expectativas de pruebas identificados en las fases Email y
de guards se mantienen para esa validación posterior.
