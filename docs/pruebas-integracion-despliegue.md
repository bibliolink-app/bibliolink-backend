# Pruebas de integración previas al despliegue en Vercel

> Estado: **completo** — ocho pasos ejecutados el 21 y 22 de octubre de 2026.
> Rama: `Andres-Features` (commit `4fcdf3a`) · Fecha: 21 de octubre de 2026

## Objetivo

La app despliega en Vercel pero "se cae". La sospecha inicial (**Escenario A**)
es que arranca y responde rutas simples como `/categories`, pero falla cuando
Reading procesa un PDF, porque PDF.js se carga recién en ese momento.

Este documento valida esa sospecha y, en general, busca anomalías que puedan
romper el despliegue, recorriendo **todo el proyecto**: código, configuración,
dependencias, scripts, pruebas existentes y cada módulo por HTTP.

## Cómo se ejecuta Vercel con este proyecto

Datos tomados de la documentación oficial (ver [Fuentes](#fuentes)):

- Vercel detecta NestJS sin configuración si el punto de entrada es
  `src/main.ts`. Toda la app pasa a ser **una sola Vercel Function** con
  Fluid compute.
- El código que se sube no es el repositorio completo: Vercel **rastrea las
  importaciones** desde el punto de entrada y empaqueta solo los archivos que
  encuentra. Lo que se carga de forma dinámica (rutas armadas en tiempo de
  ejecución, `require` indirectos) puede quedar fuera.
- Límites relevantes:

| Límite | Valor |
| --- | --- |
| Tamaño del paquete (sin comprimir) | 250 MB |
| Cuerpo de la petición **y de la respuesta** | **4.5 MB** (`413 FUNCTION_PAYLOAD_TOO_LARGE`) |
| Duración máxima por petición | 300 s (Hobby y Pro por omisión) |
| Memoria | 2 GB / 1 vCPU (Hobby) |
| Descriptores de archivo | 1 024 compartidos entre peticiones concurrentes |
| Sistema operativo | Linux (Amazon Linux) — distinto del entorno local (Windows) |

## Índice de pasos

| Paso | Qué se prueba | Estado |
| --- | --- | --- |
| 1 | Inventario del proyecto y configuración | Hecho |
| 2 | Compilación, lint y pruebas existentes | Hecho |
| 3 | Variables de entorno y arranque | Hecho |
| 4 | Empaquetado para Vercel (rastreo de archivos) | Hecho — **Escenario A confirmado** |
| 5 | Integración HTTP por módulo | Hecho — 103/104 |
| 6 | Reading: los cuatro formatos y el Escenario A | Hecho — falla solo PDF |
| 7 | Comportamiento serverless (estado en memoria, SSE, límites) | Hecho |
| 8 | Scripts fuera de `src/` | Hecho |
| — | Conclusiones y recomendaciones | Hecho |

---

## Paso 1 — Inventario del proyecto

**Qué hay en el repositorio** (además de `src/`): `test/app.e2e-spec.ts`,
`scripts/` (3 scripts de PayPal), configuración de TypeScript, Nest, Vitest,
oxlint, Prettier y pnpm. **No hay `vercel.json`**: el despliegue depende
por completo de la detección automática de Vercel.

**Módulos en `src/`:** ads, analytics, auth, books, captcha, catalogs,
categories, common, config, database, email, favorites, payment_transactions,
reading, seed, subscriptions, users.

**Dependencias con riesgo en un entorno serverless:**

| Paquete | Por qué importa | Tamaño local |
| --- | --- | --- |
| `pdfjs-dist` 6.4 | Se carga con `import()` dinámico solo al leer un PDF; además carga en tiempo de ejecución un *worker*, fuentes y `.wasm` | 35 MB |
| `@napi-rs/canvas` 1.0 | Binario nativo por plataforma. Lo usa PDF.js para dibujar la página, pero **ningún archivo del proyecto lo importa** | 37 MB (binario Windows) |
| `bcrypt` 6 | Binario nativo; trae binarios precompilados para `linux-x64` | 1.2 MB |
| `typeorm`, `mysql2` | Pool de conexiones por instancia | 22 MB |

El lockfile sí incluye `@napi-rs/canvas-linux-x64-gnu`, así que en Vercel se
instala el binario correcto. La pregunta es si llega al paquete de la
función (Paso 4).

**Gestor de paquetes y Node:**

| | Local | Vercel |
| --- | --- | --- |
| Node | 22.18 | Sin fijar (`engines` no existe en `package.json`): usa la versión por omisión del proyecto |
| pnpm | 11.1 | Con `lockfileVersion: '9.0'` y sin `packageManager`, Vercel usa **pnpm 9 o 10** |

> ⚠️ **Hallazgo 1.1 — versiones no fijadas.** `pnpm-workspace.yaml` usa
> `allowBuilds`, una opción de pnpm 11. En pnpm 9/10 se ignora. Hoy no
> rompe nada (bcrypt trae binarios precompilados), pero el entorno de Vercel
> no es el mismo que el local. Conviene fijar `"packageManager": "pnpm@11.1.1"`
> y `"engines": { "node": "22.x" }`.

## Paso 2 — Compilación, lint y pruebas existentes

| Verificación | Resultado |
| --- | --- |
| `pnpm build` | ✅ Compila |
| `tsc --noEmit` (incluye `test/` y los `.spec.ts`) | ✅ Sin errores de tipos |
| `pnpm lint` | ✅ 0 errores, 10 avisos (imports sin usar en `payment_transactions.controller.ts`, parámetros sin usar en `books.service.ts`) |
| `pnpm test` (unitarias) | ❌ **6 fallan**, 59 pasan, 11 omitidas |
| `*.mysql.spec.ts` con `ADS_MYSQL_TESTS=1 ANALYTICS_MYSQL_TESTS=1` | ✅ 11/11 (usan tablas temporales, no tocan datos) |
| `pnpm test:e2e` | ❌ 1/1 falla |

**Detalle de las fallas:**

| Prueba | Causa | ¿Afecta producción? |
| --- | --- | --- |
| `auth-infrastructure.spec` › *requires a valid subject and expiration claim* (access y refresh) | **Un JWT sin `exp` se acepta.** `passport-jwt` solo valida la expiración si el token la trae, y `JwtStrategy.validate` no exige el claim. La prueba se escribió justo para esto y hoy falla. | **Sí — seguridad.** Un token firmado sin expiración sería válido para siempre. Solo se puede firmar con el secreto, pero si el secreto se filtra el daño no caduca. |
| `auth-infrastructure.spec` › 3 pruebas de `AuthCookieService` | La prueba simula `envs` sin la sección `cookies`, que el código usa desde que se agregó `AUTH_COOKIE_MAX_AGE`. | No — la prueba está desactualizada. |
| `ads.service.spec` › *should issue and persist a reward challenge* | Se pasa el límite de 10 s al compilar el módulo de prueba cuando corre junto al resto. **Sola pasa (5/5).** | No — prueba inestable por carga. |
| `test/app.e2e-spec.ts` › `GET /` | Es la prueba de ejemplo del generador de Nest: espera `Hello World!` en `/`, ruta que no existe. | **Indirectamente:** abrir la URL raíz del despliegue devuelve **404**. Quien lo pruebe en el navegador puede creer que la app se cayó. |

Lo positivo de la e2e: arranca el `AppModule` completo contra MySQL sin
errores de inyección, así que el grafo de dependencias está bien armado.

> ⚠️ **Hallazgo 2.1 — JWT sin expiración aceptado** (seguridad, no causa caídas).
> ⚠️ **Hallazgo 2.2 — `GET /` responde 404**: no hay ruta raíz ni de salud.
> Para verificar un despliegue conviene un `GET /health` que no dependa de la
> base de datos.

## Paso 3 — Variables de entorno y arranque

**Método:** se ejecutó la app compilada (`node dist/main.js`, como la corre
Vercel) en un proceso aparte, sin el archivo `.env` (en Vercel no existe: las
variables vienen del panel del proyecto), y se consultó `GET /categories`
hasta que respondiera.

> ℹ️ **Limitación del entorno local.** En esta máquina solo cargar los módulos
> de Node tarda entre 28 y 32 s (`@nestjs/core` 7.5 s, `typeorm` 3.6 s, el
> grafo completo 15–32 s), incluso con la caché del disco caliente. Es el
> sistema de archivos de Windows (antivirus revisando `node_modules`), no la
> app. Los tiempos de arranque de abajo **no representan a Vercel**; lo que sí
> vale es si arranca o no, y por qué.

| Escenario | Resultado |
| --- | --- |
| 1. Como en local (lee `.env`) | ✅ Arranca, `GET /categories` → 200 |
| 2. `NODE_ENV=production`, todas las variables, sin `.env` | ✅ Arranca, `GET /categories` → 200 |
| 3. Faltan dos variables requeridas | ❌ **Termina al instante** con `Config validation error: "PAYMENT_CHECKOUT_REFERENCE_SECRET" is required…` |
| 4. Base de datos que no responde (host equivocado o bloqueado por firewall) | ❌ **Reintenta 9 veces y termina a los 134 s** con `ETIMEDOUT` |
| 5. Base que rechaza la conexión (`localhost` sin MySQL) | ❌ **Reintenta y termina a los 96 s** con `ECONNREFUSED` |

**Por qué importa en Vercel:**

- La validación de variables (`src/config/envs.ts`) corre **al cargar el
  módulo**, antes de crear la app. Si falta **una sola** de las 32 variables
  requeridas, la función se cae en **todas** las rutas, incluida
  `/categories`. Las que no están en el panel de Vercel no se toman del
  `.env`, porque ese archivo no se sube (está en `.gitignore`).
- `NestFactory.create` **espera la conexión a MySQL** antes de atender
  peticiones, y TypeORM reintenta por omisión 9 veces cada 3 s. Si la base no
  es alcanzable desde Vercel, cada arranque en frío se queda colgado más de un
  minuto y medio y luego falla. Casos típicos:
  - `DATABASE_HOST=localhost` copiado del `.env` local: en Vercel no hay MySQL
    en `localhost`.
  - Un MySQL en la nube que solo acepta IPs autorizadas: Vercel usa IPs
    dinámicas, así que hay que permitir conexiones desde cualquier origen o
    usar un proveedor pensado para serverless.
  - Un MySQL que exige TLS: la conexión no configura `ssl`, y la mayoría de
    los proveedores en la nube lo exigen.

> ❌ **Hallazgo 3.1 — una variable faltante tumba toda la app.** Es la causa
> más probable de un "se cae siempre", incluso en `/categories`. Hay que
> cargar en Vercel las 32 requeridas: `FRONTEND_URL`, las 6 de `DATABASE_*`,
> las 6 de JWT y cookies, `BREVO_API_KEY`, `EMAIL_SENDER_EMAIL`,
> `EMAIL_PASSWORD_RESET_TEMPLATE_ID`, `CAPTCHA_SECRET_KEY`, 5 de `PAYMENT_*` y
> las 10 de `*_THROTTLE_*`.
>
> ❌ **Hallazgo 3.2 — una base inalcanzable cuelga cada arranque 1.5–2 min.**
> Conviene bajar `retryAttempts` (por ejemplo a 1–2) para fallar rápido y que
> el error se vea en los logs de Vercel.

**Otras observaciones del arranque:**

- `.env` tiene `TURNSTILE_SECRET_KEY` y `ROOT_ADMIN_EMAIL`, que la app no
  valida. El seed exige además `ROOT_ADMIN_PASSWORD`, `ROOT_ADMIN_USERNAME`,
  `ROOT_ADMIN_FIRST_NAME`, `ROOT_ADMIN_FIRST_SURNAME` y
  `ROOT_ADMIN_BIRTH_DATE`, que **no están** en el `.env`: `pnpm seed` registra
  los proveedores y falla al crear el administrador.
- Con `NODE_ENV=production` las cookies pasan a `Secure` y el log a nivel
  `info`. No hay otras diferencias de comportamiento.

## Paso 4 — Empaquetado para Vercel

**Método:** Vercel decide qué archivos sube a la función con
[`@vercel/nft`](https://github.com/vercel/nft), que sigue los `import` y
`require` desde el punto de entrada. Se ejecutó la misma herramienta
(v1.11) sobre `dist/main.js` y, con la lista resultante, se armó una
**carpeta que contiene solo esos archivos**: una simulación de lo que
recibe la función. Después se arrancó la app y se procesaron PDFs reales
desde esa carpeta, sin acceso al `node_modules` completo del proyecto.

### 4.1 Qué entra y qué no

El paquete pesa **11.8 MB** (3 147 archivos), lejos del límite de 250 MB.

| Archivo | ¿Entra? | Por qué |
| --- | --- | --- |
| `pdfjs-dist/legacy/build/pdf.mjs` | ✅ | El `import()` del procesador usa un texto fijo |
| `pdfjs-dist/legacy/build/pdf.worker.mjs` | ❌ | PDF.js lo carga con `import(this.workerSrc)`, una ruta calculada |
| `pdfjs-dist/standard_fonts/`, `cmaps/`, `wasm/` | ❌ | Se leen en tiempo de ejecución, por ruta |
| `@napi-rs/canvas` (JS y binario nativo) | ❌ | PDF.js lo carga con `createRequire(...)("@napi-rs/canvas")`; el proyecto nunca lo importa |
| **`mysql2`** | ❌ | **TypeORM lo carga con `require(name)`**, con el nombre en una variable |
| `bcrypt` (binario precompilado) | ✅ | `node-gyp-build` es un caso conocido de nft |
| `yauzl`, `sanitize-html`, `htmlparser2`, `fast-xml-parser` | ✅ | Imports estáticos |

### 4.2 Lo que pasa con ese paquete

| Paquete simulado | Arranque | `GET /categories` | PDF de arXiv | PDF con Helvetica |
| --- | --- | --- | --- | --- |
| **A.** Tal cual lo rastrea nft | ❌ `DriverPackageNotInstalledError: Mysql package has not been found installed` (9 reintentos y sale) | — | — | — |
| **B.** A + `mysql2` | ✅ | ✅ 200 | ❌ 422 | ❌ 422 |
| **C1.** B + `@napi-rs/canvas` | — | — | ❌ 422 | ❌ 422 |
| **C3.** B + canvas + `pdf.worker.mjs` | — | — | ✅ 1.5 s, 505 KB | ✅ |
| Proyecto completo (local) | ✅ | ✅ 200 | ✅ 4.6 s, 505 KB | ✅ |

El paquete **B es exactamente el Escenario A**: la app arranca y `/categories`
responde, pero cualquier PDF devuelve `422 No fue posible procesar el
contenido PDF`. Con B, PDF.js deja estos avisos y falla:

```
Warning: Cannot load "@napi-rs/canvas" package: "Error: Cannot find module '@napi-rs/canvas'"
Warning: Cannot polyfill `DOMMatrix`, rendering may be broken.
Warning: Cannot polyfill `Path2D`, rendering may be broken.
```

Con C1 (canvas sí, worker no) sigue fallando: PDF.js también necesita su
*worker*. Recién con canvas **y** worker (C3) los PDFs se procesan.

> ❌ **Hallazgo 4.1 — Escenario A confirmado.** En Vercel, Reading no puede
> procesar ningún PDF: faltan `@napi-rs/canvas` y `pdf.worker.mjs` en la
> función. Localmente nunca falla porque ahí está todo `node_modules`.
>
> ❌ **Hallazgo 4.2 — `mysql2` puede quedar fuera del paquete y tumbar toda la
> app.** Es un problema conocido de TypeORM en Vercel (ver Fuentes). Si en
> los logs de Vercel aparece `DriverPackageNotInstalledError`, es esto; si
> `/categories` sí responde en el despliegue, el builder lo incluyó por otra
> vía y solo aplica el 4.1. Se corrige pasando el driver explícitamente:
> `TypeOrmModule.forRoot({ ..., driver: require('mysql2') })`, así el rastreo
> lo encuentra.
>
> ⚠️ **Hallazgo 4.3 — el error real del PDF se pierde.**
> `PdfContentProcessorService` atrapa cualquier error y lo reemplaza por
> `422 No fue posible procesar el contenido PDF` **sin registrarlo**. En los
> logs de Vercel no queda ni la causa ni los avisos de PDF.js. Es lo que hace
> difícil diagnosticar el Escenario A desde el panel.

**Cómo corregirlo** (sin probar en Vercel; validado con el paquete simulado):

1. Importar `@napi-rs/canvas` en el procesador, antes de PDF.js, para que el
   rastreo lo encuentre y el binario de Linux entre al paquete.
2. Incluir el worker: importarlo y asignarlo a `globalThis.pdfjsWorker`
   antes de `getDocument` (así el rastreo lo encuentra solo), o declararlo
   en `vercel.json` junto con las fuentes y los `.wasm`. La clave de la
   función con detección automática de NestJS hay que confirmarla en el
   panel de Vercel:
   ```json
   { "functions": { "src/main.ts": { "includeFiles": "node_modules/pdfjs-dist/{legacy/build/pdf.worker.mjs,standard_fonts/**,wasm/**}" } } }
   ```
3. Pasar `standardFontDataUrl` (y `wasmUrl`) a `getDocument`: hoy PDF.js
   avisa `Ensure that the standardFontDataUrl API parameter is provided`.

### 4.3 Otras observaciones del paquete

- **Fuentes en Linux (riesgo, sin confirmar).** El PDF de prueba con
  Helvetica sin incrustar se dibujó en Windows (1 % de píxeles con tinta)
  gracias a las fuentes del sistema. La imagen de Linux de Vercel es mínima;
  sin `standardFontDataUrl` el texto de esos PDFs podría salir en blanco. Los
  PDF de arXiv traen sus fuentes incrustadas y no dependen de esto.
- En la simulación de Windows, Skia (el motor de `@napi-rs/canvas`) **aborta
  el proceso** si falta su archivo `icudtl.dat`. El binario de Linux no usa
  ese archivo (se revisó el paquete publicado), así que **esto no aplica a
  Vercel**; se deja anotado porque un aborto nativo no se puede atrapar.

## Paso 5 — Integración HTTP por módulo

**Método:** se arrancó la app completa en el mismo proceso de prueba con
**la misma configuración que `src/main.ts`** (cookies, CORS, `ValidationPipe`
con `whitelist` y `forbidNonWhitelisted`, `HttpExceptionFilter`, `rawBody`) y
se recorrieron todas las rutas por HTTP con `supertest`, contra la base local
y las APIs reales de los proveedores. Para no depender de servicios externos
de pago se usaron:

- la **clave de prueba oficial de Cloudflare Turnstile**, que siempre valida
  el CAPTCHA;
- las credenciales de relleno de PayPal del `.env` local (los pagos se
  prueban hasta donde no hace falta PayPal);
- un usuario creado por la API, un administrador creado en la base y libros
  de prueba de los cinco formatos.

Los límites de *throttling* se ampliaron en esta corrida para que no
interfirieran; se prueban aparte, con los valores reales, en el Paso 7. Todo
lo creado se borró al terminar (usuarios, suscripciones, favoritos, accesos y
libros).

**Resultado: 104 verificaciones, 103 pasan.**

| Módulo | Verificaciones | Pasan | Fallan |
| --- | --- | --- | --- |
| General | 7 | 6 | 1 |
| Catalogs | 7 | 7 | 0 |
| Books | 12 | 12 | 0 |
| Categories | 4 | 4 | 0 |
| Auth | 19 | 19 | 0 |
| Users | 12 | 12 | 0 |
| Analytics | 4 | 4 | 0 |
| Favorites | 12 | 12 | 0 |
| Subscriptions | 8 | 8 | 0 |
| Reading | 19 | 19 | 0 |
| **Total** | **104** | **103** | **1** |

### Hallazgos del Paso 5

> ❌ **Hallazgo 5.1 — un cuerpo demasiado grande responde 500 en vez de 413.**
> `express` rechaza bien un JSON de 1 MB (límite de 100 KB), pero
> `HttpExceptionFilter` solo reconoce `HttpException` y convierte el
> `PayloadTooLargeError` en `500 Ha ocurrido un error inesperado`. En Vercel
> cada uno de esos queda registrado como error de servidor. El JSON mal
> formado sí responde 400 (Nest ya lo traduce). Corrección: en el filtro, usar
> el `status` de los errores de `body-parser` cuando exista.
>
> ⚠️ **Hallazgo 5.2 — endpoints que escriben o consumen mucho están abiertos.**
> Sin iniciar sesión se puede llamar a `POST /books/import`,
> `/books/import/search`, `/books/import/providers/:code` y
> `/books/import/all`. Uno solo de estos con `maxPages: 500` mantiene ocupada
> la función hasta el límite de 300 s y hace cientos de llamadas a las APIs
> externas. También responden los *scaffolds* `POST /books`,
> `PATCH /books/:id` y `DELETE /books/:id`, que no hacen nada pero devuelven
> 200/201 con textos como `This action removes a #7 book`.
>
> ⚠️ **Hallazgo 5.3 — la API de arXiv limita por IP.** Durante las pruebas
> `export.arxiv.org` empezó a responder `429 Too Many Requests` a esta IP, y
> `POST /books/import` de un artículo de arXiv devuelve 503. Las funciones de
> Vercel salen a internet desde IPs compartidas con otros proyectos, así que
> es esperable ver más 429 desde Vercel que en local. La descarga del PDF
> (`arxiv.org/pdf/...`) sí respondió; lo afectado es la búsqueda y la
> importación.
>
> ⚠️ **Hallazgo 5.4 — Reading excluye a los administradores.** El controller
> exige el rol `USER`, así que un `ADMIN` recibe 403 al abrir un libro y en
> `GET /subscriptions/membership`. Puede ser intencional, pero conviene
> confirmarlo antes de probar el despliegue con una cuenta de administrador.

**Otras observaciones (no rompen nada):**

- **CORS:** el preflight desde `FRONTEND_URL` responde con
  `Access-Control-Allow-Origin` y `credentials`. Desde otro origen el servidor
  devuelve igual el `FRONTEND_URL` configurado, así que el navegador bloquea:
  correcto. Como `origin` es un único valor, **las URLs de *preview* del
  frontend en Vercel** (cada despliegue tiene la suya) quedan bloqueadas.
- **Cookies:** `access_token` (`Path=/`, 15 min) y `refresh_token`
  (`Path=/auth/refresh`, 7 días), ambas `HttpOnly; SameSite=Lax`. En
  producción se agrega `Secure`. Ver el Hallazgo 7.1 sobre `SameSite`.
- **Tiempos con proveedores externos:** una búsqueda en todos los proveedores
  tardó **18.8 s** (Gutendex se suspende por inactividad) y
  `POST /favorites/external` llegó a **20 s** y cortó con 503 cuando Gutendex no
  respondía. `POST /books/import/all` con **una sola página** tardó **23 s**.
- **Reading descarga el libro completo en cada página:** HTML de Drácula
  1.2 s, EPUB 0.8 s, PDF 2 s (página 1) y 0.4 s (página 2). No hay caché.
- **EPUB pagina por capítulo**, no por tamaño: Drácula de Standard Ebooks
  tiene 35 páginas de entre 53 y 40 478 caracteres (promedio 25 059),
  mientras que HTML y TEXT cortan en ~6 000. La página 1 es la portada
  (92 caracteres).
- `GET /payment-transactions` responde 404: el controller está vacío.
- El formato de error es uniforme
  (`{ statusCode, message, error, path, timestamp }`).

### Detalle de cada verificación

<details><summary><b>General</b> — 6/7</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET / (raíz del despliegue) | 404 | ✅ 404 | 47 ms |  |
| GET ruta inexistente: formato del error | 404 | ✅ 404 | 10 ms | cuerpo {"statusCode":404,"message":"Cannot GET /no-existe","error":"NOT_FOUND","path":"/no-existe","timestamp":"2026-10-22T04:08:50.779Z"} |
| GET /payment-transactions (controller vacío) | 404 | ✅ 404 | 9 ms |  |
| CORS preflight desde FRONTEND_URL | 204/200 | ✅ 204 | 6 ms | ACAO + credentials |
| CORS desde otro origen | 204/200 | ✅ 204 | 6 ms | ACAO=http://localhost:5173 (no coincide: el navegador bloquea) |
| JSON mal formado | 400 | ✅ 400 | 36 ms |  |
| Cuerpo JSON de 1 MB | 413 | ❌ 500 | 20 ms | Ha ocurrido un error inesperado. |

</details>

<details><summary><b>Catalogs</b> — 7/7</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET /catalogs/providers | 200 | ✅ 200 | 36 ms | 4 proveedores |
| GET /catalogs/search?query=dracula&pageSize=2 | 200 | ✅ 200 | 10222 ms | sin datos internos; 3 proveedores, no disp. ["arxiv"] |
| search con provider inválido | 400 | ✅ 400 | 15 ms |  |
| search con parámetro no permitido | 400 | ✅ 400 | 7 ms |  |
| search pageSize=51 | 400 | ✅ 400 | 7 ms |  |
| GET /catalogs/providers/standard-ebooks/book | 200 | ✅ 200 | 310 ms | sin contentReference |
| detalle con referencia inexistente | 404/503 | ✅ 503 | 429 ms |  |

</details>

<details><summary><b>Books</b> — 12/12</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET /books | 200 | ✅ 200 | 46 ms | 1 libros, sin datos internos |
| GET /books/abc | 400 | ✅ 400 | 7 ms |  |
| GET /books/999999 | 404 | ✅ 404 | 10 ms |  |
| POST /books (scaffold, sin auth) | 201/401/403 | ✅ 201 | 8 ms | responde "This action adds a new book" |
| PATCH /books/7 (scaffold, sin auth) | 200/401/403 | ✅ 200 | 6 ms | responde "This action updates a #7 book" |
| DELETE /books/7 (scaffold, sin auth) | 200/401/403 | ✅ 200 | 5 ms | responde "This action removes a #7 book" |
| POST /books/import (sin auth) — EPUB de Standard Ebooks | 201 | ✅ 201 | 213 ms |  |
| POST /books/import — PDF de arXiv | 201/503 | ✅ 503 | 11964 ms | arXiv no respondió (la API devuelve 429 a esta IP) |
| POST /books/import — página externa de OpenAlex | 201 | ✅ 201 | 795 ms |  |
| POST /books/import con body inválido | 400 | ✅ 400 | 6 ms |  |
| POST /books/import/all (sin auth) maxPages=1 pageSize=1 | 200/201 | ✅ 201 | 3558 ms | importó 10 sin autenticación |
| POST /books/import/all maxPages=501 | 400 | ✅ 400 | 7 ms |  |

</details>

<details><summary><b>Categories</b> — 4/4</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET /categories | 200 | ✅ 200 | 12 ms | 28 categorías |
| GET /categories/fiction/books | 200 | ✅ 200 | 32 ms | totalItems 10 |
| código inválido | 400 | ✅ 400 | 6 ms |  |
| pageSize=51 | 400 | ✅ 400 | 4 ms |  |

</details>

<details><summary><b>Auth</b> — 19/19</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| POST /auth/register | 201 | ✅ 201 | 285 ms |  |
| register duplicado | 409 | ✅ 409 | 33 ms |  |
| register con CAPTCHA inválido | 400 | ✅ 400 | 7 ms |  |
| register con contraseña débil | 400 | ✅ 400 | 5 ms |  |
| register con campo extra | 400 | ✅ 400 | 5 ms |  |
| GET /auth/me sin sesión | 401 | ✅ 401 | 6 ms |  |
| login con contraseña incorrecta | 401 | ✅ 401 | 94 ms |  |
| POST /auth/login | 200 | ✅ 200 | 115 ms | Set-Cookie: Max-Age=900; Path=/; Expires=Thu, 22 Oct 2026 04:24:19 GMT; HttpOnly; SameSite=Lax | Max-Age=604800; Path=/auth/refresh; Expires=Thu, 29 O |
| GET /auth/me con sesión | 200 | ✅ 200 | 12 ms | USER ACTIVE |
| POST /auth/refresh | 200 | ✅ 200 | 13 ms |  |
| refresh sin cookie | 401 | ✅ 401 | 7 ms |  |
| change-password con actual incorrecta | 400/401 | ✅ 400 | 103 ms |  |
| change-password | 200 | ✅ 200 | 301 ms |  |
| login con la contraseña nueva | 200 | ✅ 200 | 107 ms |  |
| forgot-password con correo inexistente | 200 | ✅ 200 | 9 ms |  |
| reset-password con token inválido | 400 | ✅ 400 | 103 ms |  |
| login admin | 200 | ✅ 200 | 95 ms |  |
| POST /auth/logout | 200 | ✅ 200 | 5 ms | 2 cookies borradas |
| GET /auth/me después del logout | 401 | ✅ 401 | 4 ms |  |

</details>

<details><summary><b>Users</b> — 12/12</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET /users/profile (usuario) | 200 | ✅ 200 | 10 ms | sin passwordHash |
| GET /users como USER | 403 | ✅ 403 | 8 ms |  |
| GET /users como ADMIN | 200 | ✅ 200 | 10 ms | 2 usuarios, sin hashes |
| GET /users/:id | 200 | ✅ 200 | 10 ms |  |
| GET /users/abc | 400 | ✅ 400 | 9 ms |  |
| PATCH /users/:id | 200 | ✅ 200 | 56 ms |  |
| PATCH /users/:id con email duplicado | 409 | ✅ 409 | 13 ms |  |
| POST /users/admins | 201 | ✅ 201 | 123 ms |  |
| disable | 200 | ✅ 200 | 31 ms |  |
| GET /auth/me del usuario deshabilitado | 401 | ✅ 401 | 8 ms |  |
| enable | 200 | ✅ 200 | 23 ms |  |
| el admin no puede deshabilitarse | 400 | ✅ 400 | 10 ms |  |

</details>

<details><summary><b>Analytics</b> — 4/4</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET /analytics/summary como ADMIN | 200 | ✅ 200 | 17 ms |  |
| GET /analytics/summary como USER | 403 | ✅ 403 | 7 ms |  |
| GET /analytics/registrations?period=day | 200 | ✅ 200 | 10 ms |  |
| registrations sin period | 400 | ✅ 400 | 8 ms |  |

</details>

<details><summary><b>Favorites</b> — 12/12</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET /favorites sin sesión | 401 | ✅ 401 | 4 ms |  |
| GET /favorites | 200 | ✅ 200 | 13 ms | FREE 0/3 |
| agregar HTML | 201 | ✅ 201 | 41 ms |  |
| agregar EPUB | 201 | ✅ 201 | 42 ms |  |
| agregar PDF | 201 | ✅ 201 | 37 ms |  |
| 4º favorito (límite FREE) | 403 | ✅ 403 | 20 ms |  |
| duplicado | 403/409 | ✅ 409 | 17 ms |  |
| PATCH progreso | 200 | ✅ 200 | 25 ms |  |
| PATCH progreso 101 | 400 | ✅ 400 | 9 ms |  |
| GET progreso | 200 | ✅ 200 | 10 ms | 42.5% cap-3 |
| DELETE favorito | 204 | ✅ 204 | 18 ms |  |
| POST /favorites/external | 201/503 | ✅ 201 | 41 ms |  |

</details>

<details><summary><b>Subscriptions</b> — 8/8</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET /subscriptions/membership | 200 | ✅ 200 | 10 ms | {"membership":"FREE"} |
| GET /subscriptions/membership como ADMIN | 403 | ✅ 403 | 9 ms |  |
| POST /subscriptions (reserva) | 201 | ✅ 201 | 122 ms | subscriptionId 4 |
| segunda reserva | 409 | ✅ 409 | 14 ms |  |
| POST /subscriptions/confirm (PayPal con credenciales de relleno) | 502/503/404/422 | ✅ 503 | 740 ms |  |
| webhook sin cuerpo | 400 | ✅ 400 | 4 ms |  |
| webhook con firma falsa | 400/401/403/503 | ✅ 503 | 6 ms |  |
| GET /subscriptions/events (SSE) | 200 | ✅ 200 | 21 ms | text/event-stream |

</details>

<details><summary><b>Reading</b> — 19/19</summary>

| Caso | Esperado | Obtenido | Tiempo | Nota |
| --- | --- | --- | --- | --- |
| GET página sin iniciar periodo | 403 | ✅ 403 | 18 ms |  |
| POST access como ADMIN | 403 | ✅ 403 | 9 ms |  |
| POST access (libro HTML) | 200 | ✅ 200 | 27 ms | FREE canRead=true |
| POST access de una página externa | 422 | ✅ 422 | 12 ms |  |
| GET página 1 — HTML | 200 | ✅ 200 | 1201 ms | HTML, 6.9 KB, hasNextPage=true |
| GET página 1 — TEXT | 200 | ✅ 200 | 432 ms | HTML, 5.8 KB, hasNextPage=true |
| GET página 1 — EPUB | 200 | ✅ 200 | 778 ms | HTML, 0.2 KB, hasNextPage=true |
| GET página 1 — PDF | 200 | ✅ 200 | 2035 ms | IMAGE, 504.7 KB, hasNextPage=true |
| GET página 2 — PDF | 200 | ✅ 200 | 433 ms | 751.0 KB |
| GET página 99999 — PDF | 422 | ✅ 422 | 90 ms |  |
| GET página 0 | 400/422 | ✅ 422 | 680 ms |  |
| GET página 99999 — EPUB | 422 | ✅ 422 | 768 ms |  |
| reward-challenge con periodo vigente | 409 | ✅ 409 | 12 ms |  |
| GET página con periodo vencido | 403 | ✅ 403 | 17 ms |  |
| reward-challenge con periodo vencido | 200 | ✅ 200 | 30 ms |  |
| POST reward con token inválido | 400/409 | ✅ 409 | 18 ms |  |
| POST reward con token válido | 200 | ✅ 200 | 31 ms | canRead=true |
| POST reward repetido | 409 | ✅ 409 | 13 ms |  |
| GET página tras la recompensa | 200 | ✅ 200 | 905 ms |  |

</details>

## Paso 6 — Reading: los cuatro formatos y el Escenario A

Este paso junta lo medido en los Pasos 4 y 5 para el módulo que motivó la
revisión.

| Formato | Local por HTTP | Desde el paquete simulado de Vercel | Tamaño de la respuesta |
| --- | --- | --- | --- |
| HTML (Gutenberg) | ✅ 1.2 s | ✅ | 6.9 KB por página |
| TEXT (Gutenberg) | ✅ 0.4 s | ✅ | 5.8 KB por página |
| EPUB (Standard Ebooks) | ✅ 0.8 s | ✅ | 0.2–40 KB (una página = un capítulo) |
| **PDF (arXiv)** | ✅ 2.0 s (pág. 1), 0.4 s (pág. 2) | ❌ **422 en todas las páginas** | 505–751 KB por página |

HTML, TEXT y EPUB usan solo librerías que se importan de forma estática
(`sanitize-html`, `htmlparser2`, `yauzl`, `fast-xml-parser`), así que el
rastreo de Vercel las incluye. **Solo PDF depende de archivos que se cargan
en tiempo de ejecución**, por eso es el único que falla en el despliegue y
el único que nunca falla en local.

**Tamaño de las páginas PDF.** PDF.js dibuja cada página a escala 1.5 y la
devuelve como PNG en base64 dentro del JSON. Con PDFs de prueba de una sola
imagen a página completa:

| PDF | Respuesta | ¿Cabe en 4.5 MB? |
| --- | --- | --- |
| Artículo de arXiv (texto y fórmulas) | 505 KB | ✅ |
| Carta escaneada a 150 dpi | 2.4 MB | ✅ |
| Carta con ruido (peor caso, PNG no comprime) | 4.6 MB | ❌ |
| A3 escaneado a 150 dpi | 5.0 MB | ❌ |

> ❌ **Hallazgo 6.1 — páginas PDF con mucha imagen superan el límite de
> respuesta de Vercel.** Por encima de 4.5 MB Vercel corta con
> `413 FUNCTION_PAYLOAD_TOO_LARGE`. Afecta a escaneos y páginas grandes, no a
> artículos de texto. Se resuelve devolviendo JPEG o WebP en vez de PNG,
> bajando la escala, o sirviendo la imagen como archivo binario en lugar de
> base64 (que agrega un 33 %).

**Otras observaciones de Reading:**

- Cada página **vuelve a descargar el libro completo** del proveedor. Un PDF
  de hasta `READING_CONTENT_MAX_BYTES` (50 MB) se descarga y se abre entero
  por cada página, dentro del tiempo límite de la función.
- El rol `ADMIN` no puede leer (Hallazgo 5.4).
- La regla de licencias sigue pendiente: Reading renderiza PDFs de arXiv y
  OpenAlex en el servidor, y los términos de uso de arXiv prohíben servir sus
  PDFs desde un servidor propio sin permiso del autor.

## Paso 7 — Comportamiento serverless

En Vercel la app no es un único proceso permanente: cada instancia puede
apagarse cuando no hay tráfico, Vercel crea más cuando sube la carga, y cada
petición tiene un tiempo máximo. Lo que funciona en un servidor tradicional
puede fallar acá.

| Tema | Qué se midió o revisó | Riesgo en Vercel |
| --- | --- | --- |
| **Throttling** | Con los límites reales: el `429` aparece en el intento 11 de login (límite 10/min) ✅. Un login con otro `X-Forwarded-For` **comparte el contador**: la app no configura `trust proxy` y cuenta por la IP del socket. | ❌ Detrás del proxy de Vercel los usuarios pueden compartir el mismo contador: 10 logins por minuto para **todos**. Además, cada instancia cuenta por su lado (memoria local). |
| **Cookies de sesión** | `SameSite=Lax`, `HttpOnly`, `Secure` solo en producción. | ❌ Ver Hallazgo 7.1. |
| **SSE** (`/subscriptions/events`) | Responde `text/event-stream` con un latido cada 15 s y no termina nunca. Los eventos se publican en un `Subject` de RxJS en memoria. | ❌ El webhook de PayPal que activa la suscripción y la conexión SSE del usuario pueden caer en instancias distintas: el aviso no llega. Además Vercel corta la conexión a los 300 s y se paga todo ese tiempo como función activa. |
| **Conexiones a MySQL** | Una instancia abre **hasta 10 conexiones** con 40 peticiones concurrentes (el pool de `mysql2` por omisión). | ⚠️ Cada instancia nueva suma 10. Los MySQL administrados de nivel gratuito suelen tener límites bajos de conexiones; al llenarse, las consultas fallan con `Too many connections`. |
| **Cola de arXiv** | La pausa de 3 s entre llamadas se guarda en memoria del proveedor. | ⚠️ Es por instancia: con varias instancias no se respeta, lo que favorece los `429` del Hallazgo 5.3. |
| **Duración** | Una búsqueda en todos los proveedores tardó 18.8 s; `import/all` con una página, 23 s; Gutendex llegó a 35 s en frío. | ⚠️ `import/all` con valores por omisión (20 páginas × 4 proveedores) puede pasar los 300 s y cortarse con `504`. Lo importado hasta ese momento queda guardado. |
| **Arranque en frío** | El arranque espera a MySQL (Paso 3). | ⚠️ Si la base tarda, la primera petición de cada instancia también. |

> ❌ **Hallazgo 7.1 — con frontend y backend en dominios distintos, la sesión
> no llega al backend.** Las cookies se emiten con `SameSite=Lax`, y el
> navegador **no envía** cookies `Lax` en peticiones `fetch` entre sitios
> distintos. `*.vercel.app` está en la *Public Suffix List*, así que
> `bibliolink-front.vercel.app` y `bibliolink-api.vercel.app` **son sitios
> distintos** aunque compartan el sufijo. El síntoma: el login responde 200,
> pero `GET /auth/me` y todo lo protegido dan 401. Soluciones: servir el
> backend bajo el mismo dominio que el frontend (un *rewrite* de `/api` en el
> proyecto del frontend), o emitir las cookies con `SameSite=None; Secure` y
> mantener CORS con `credentials`. Este punto se dedujo del comportamiento
> estándar de los navegadores; no se probó con un navegador real.
>
> ❌ **Hallazgo 7.2 — throttling y SSE asumen un único proceso.** Para el
> throttling: `app.set('trust proxy', 1)` en `main.ts` y, si importa que el
> límite sea global, un almacenamiento compartido (Redis). Para el SSE: con
> varias instancias hace falta publicar los eventos por un canal compartido,
> o reemplazar el SSE por consultas periódicas a `/subscriptions/membership`.

## Paso 8 — Scripts fuera de `src/`

| Script | Sintaxis | Qué hace | Observación |
| --- | --- | --- | --- |
| `scripts/create-paypal-product.mjs` | ✅ | Crea un producto en PayPal | Se niega a correr fuera de *sandbox* y tiene tiempo límite ✅ |
| `scripts/create-paypal-plan.mjs` | ✅ | Crea un plan de suscripción | Igual que el anterior ✅. `PRODUCT_ID` está fijo en el código |
| `scripts/check-paypal-subscription.mjs` | ✅ | Consulta una suscripción | **No valida que sea sandbox** ni tiene tiempo límite. `SUBSCRIPTION_ID` fijo en el código. Con las credenciales de relleno responde `No se pudo obtener el token. HTTP 401` |

Ninguno se referencia desde `package.json` ni desde `src/`, así que no entran
al paquete de Vercel y no afectan el despliegue. Son herramientas manuales
de configuración de PayPal.

**Pruebas existentes en `test/`:** `test/app.e2e-spec.ts` es la prueba de
ejemplo del generador de Nest y falla (Paso 2). Sirvió para comprobar que el
`AppModule` arranca completo, pero no prueba nada del dominio.

## Conclusiones y recomendaciones

### ¿Se confirma el Escenario A?

**Sí.** Con el paquete que arma el rastreo de Vercel, la app arranca y
`/categories` responde 200, pero **todo PDF falla con 422**: faltan
`@napi-rs/canvas` y `pdf.worker.mjs` en la función, y el error real no queda
en los logs. Localmente nunca falla porque ahí está todo `node_modules`.

Pero el Escenario A **no explica por sí solo que "la app se caiga"**. Si la
caída afecta también a rutas como `/categories`, las causas más probables
son, en este orden: una variable de entorno faltante (3.1), `mysql2` fuera del
paquete (4.2) o una base de datos inalcanzable desde Vercel (3.2). Las tres
tumban **todas** las rutas. Y si el login "funciona" pero después todo da
401, la causa es la cookie `SameSite=Lax` entre dominios (7.1).

**Cómo distinguirlos en los logs de Vercel:**

| Mensaje en el log | Causa |
| --- | --- |
| `Config validation error: "X" is required` | 3.1 — falta una variable |
| `DriverPackageNotInstalledError: Mysql package has not been found installed` | 4.2 — `mysql2` no entró al paquete |
| `Unable to connect to the database. Retrying (n)...` con `ETIMEDOUT`/`ECONNREFUSED` | 3.2 — base inalcanzable |
| `422` en `/reading/books/:id/pages/:n` solo para libros PDF | 4.1 — Escenario A |
| `413 FUNCTION_PAYLOAD_TOO_LARGE` en páginas PDF | 6.1 — página demasiado grande |
| Login 200 y luego `401` en todo | 7.1 — cookies entre dominios |

### Hallazgos ordenados por prioridad

| # | Hallazgo | Efecto | Prioridad |
| --- | --- | --- | --- |
| 3.1 | Falta una de las 32 variables requeridas | La app no arranca: todas las rutas fallan | 🔴 Antes de desplegar |
| 4.2 | `mysql2` fuera del paquete (TypeORM lo carga con `require` dinámico) | La app no arranca | 🔴 Antes de desplegar |
| 3.2 | Base inalcanzable desde Vercel (`localhost`, IPs permitidas, sin TLS) | Cada arranque cuelga 1.5–2 min y falla | 🔴 Antes de desplegar |
| 4.1 | **Escenario A:** canvas y worker de PDF.js fuera del paquete | Ningún PDF se puede leer | 🔴 Antes de desplegar |
| 7.1 | Cookies `SameSite=Lax` con frontend en otro dominio | Sesión rota después del login | 🔴 Antes de desplegar |
| 4.3 | El procesador PDF descarta el error real | No se puede diagnosticar desde los logs | 🟠 Junto con 4.1 |
| 6.1 | Páginas PDF con mucha imagen pasan de 4.5 MB | `413` en escaneos y páginas grandes | 🟠 |
| 7.2 | Throttling y SSE en memoria, sin `trust proxy` | Límites compartidos entre usuarios; avisos de suscripción que no llegan | 🟠 |
| 5.2 | Importaciones y *scaffolds* de `books` sin autenticación | Abuso y consumo de la función hasta 300 s | 🟠 |
| 2.1 | Se acepta un JWT sin expiración | Seguridad (un token así no caducaría) | 🟠 |
| 5.1 | Cuerpo grande responde 500 en vez de 413 | Errores 500 falsos en los logs | 🟡 |
| 5.3 | arXiv responde `429` por IP | Importar o buscar en arXiv falla a ratos | 🟡 |
| 2.2 | `GET /` responde 404 y no hay ruta de salud | Parece caída al abrir la URL | 🟡 |
| 1.1 | Node y pnpm sin fijar | El build de Vercel no usa las mismas versiones que el local | 🟡 |
| 5.4 | `ADMIN` no puede leer ni ver la membresía | Confusión al probar con un admin | 🟡 |
| — | Conexiones MySQL: 10 por instancia | `Too many connections` con un MySQL chico | 🟡 |
| — | 3 pruebas de cookies desactualizadas, 1 inestable, e2e de ejemplo | `pnpm test` en rojo | 🟡 |

### Checklist antes del próximo despliegue

1. Cargar en el panel de Vercel las 32 variables requeridas, con
   `NODE_ENV=production` y un `FRONTEND_URL` que coincida **exactamente** con
   el origen del frontend (sin `/` final).
2. Usar un MySQL accesible desde internet, con TLS si el proveedor lo pide, y
   correr `pnpm migration:run` contra esa base antes de desplegar.
3. Pasar el driver a TypeORM (`driver: require('mysql2')`) y bajar
   `retryAttempts`.
4. En el procesador PDF: importar `@napi-rs/canvas` y el worker de forma
   estática, pasar `standardFontDataUrl` y registrar el error real antes de
   responder 422.
5. Decidir el esquema de dominios: mismo dominio con un *rewrite*, o cookies
   `SameSite=None; Secure`.
6. Agregar `app.set('trust proxy', 1)` y un `GET /health` que no dependa de
   la base.
7. Después de desplegar, revisar los logs de Vercel con la tabla de arriba y
   abrir un libro de cada formato.

### Lo que no se pudo probar acá

- **Un despliegue real en Vercel.** El empaquetado se simuló con la misma
  herramienta que usa Vercel (`@vercel/nft` 1.11), pero el builder de NestJS
  podría incluir archivos de otra forma. Los hallazgos 4.1 y 4.2 hay que
  confirmarlos en los logs del despliegue.
- **Linux.** Las pruebas corrieron en Windows; el binario de canvas, las
  fuentes del sistema y los tiempos de arranque difieren.
- **Un navegador real** para el Hallazgo 7.1.
- **Pagos reales con PayPal**: no hay credenciales de sandbox en el `.env`
  local.
- **Envío de correos con Brevo**: se evitó para no mandar correos reales.

## Fuentes

- [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [Vercel — Package Managers](https://vercel.com/docs/package-managers)
- [`@vercel/nft`](https://github.com/vercel/nft) — la herramienta de rastreo que usa Vercel
- [nest-profiler PR #322](https://github.com/eleven-labs/nest-profiler/pull/322) — NestJS + TypeORM en Vercel: `DriverPackageNotInstalledError`, resuelto pasando `driver`
- [damicon PR #147](https://github.com/Wamocon/damicon/pull/147) — PDF.js en una función de Vercel: faltaban canvas y el worker
- [KCP-Portal PR #1886](https://github.com/andrewjwinig-bot/KCP-Portal/pull/1886) — `Setting up fake worker failed` en Vercel
