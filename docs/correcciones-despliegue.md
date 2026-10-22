# Correcciones previas al despliegue — evidencia

> Estado: **completo** — diez pasos verificados.
> Rama: `Andres-Features` (desde el commit `4fcdf3a`) · Fecha: 22 de octubre de 2026
> Diagnóstico de origen: [pruebas-integracion-despliegue.md](pruebas-integracion-despliegue.md)

Este documento registra cada corrección aplicada a partir de los hallazgos del
diagnóstico: qué se cambió, por qué y **la prueba que demuestra que funciona**.
Cada paso se verificó antes de pasar al siguiente.

## Plan

| Paso | Hallazgos | Corrección | Estado |
| --- | --- | --- | --- |
| 1 | 4.2, 3.2 | Driver `mysql2` explícito, reintentos cortos, pool y TLS configurables | ✅ Verificado |
| 2 | 4.1, 4.3, 6.1 | PDF.js empaquetable en Vercel, errores registrados, páginas dentro de 4.5 MB | ✅ Verificado |
| 3 | 2.1 | Rechazar JWT sin expiración | ✅ Verificado |
| 4 | 5.1 | Errores de `body-parser` con su código real (413, 415) | ✅ Verificado |
| 5 | 2.2 | `GET /` y `GET /health` | ✅ Verificado |
| 6 | 5.2 | Importaciones solo para administradores; quitar los *scaffolds* de `books` | ✅ Verificado |
| 7 | 7.1, 7.2 | `SameSite` configurable y `trust proxy` | ✅ Verificado |
| 8 | 1.1 | Versiones de Node y pnpm fijadas | ✅ Verificado |
| 9 | Paso 2 del diagnóstico | Pruebas unitarias y e2e en verde | ✅ Verificado |
| 10 | — | Verificación final: paquete simulado de Vercel + integración HTTP completa | ✅ 107/107 |

**Fuera de alcance** (requieren decisiones o infraestructura, se listan al final):
throttling y SSE compartidos entre instancias, límite de arXiv por IP,
paginación de EPUB por capítulo, acceso de administradores a Reading,
licencias de PDFs de arXiv y OpenAlex.

---

## Paso 1 — Base de datos: driver, reintentos, pool y TLS

**Hallazgos:** 4.2 (`mysql2` fuera del paquete de Vercel → la app no arranca) y
3.2 (una base inalcanzable cuelga cada arranque casi dos minutos).

**Cambios:**

| Archivo | Cambio |
| --- | --- |
| `src/config/database.config.ts` (nuevo) | Opciones de conexión en un solo lugar. Pasa `driver: mysql2` (import estático), `connectTimeout: 10 s`, `ssl` y `connectionLimit` configurables, y reintentos cortos (`retryDelay: 1 s`). |
| `src/app.module.ts` | `TypeOrmModule.forRoot` usa esas opciones. |
| `src/database/data-source.ts` | El CLI de migraciones usa las mismas opciones (antes estaban duplicadas). |
| `src/config/envs.ts` | Tres variables nuevas, **opcionales** (con valor por omisión): `DATABASE_SSL` (`false`), `DATABASE_POOL_SIZE` (`10`), `DATABASE_CONNECT_RETRIES` (`2`). |

**Evidencia:**

| Verificación | Antes | Después |
| --- | --- | --- |
| `mysql2` en el paquete rastreado por `@vercel/nft` | ❌ No | ✅ Sí (93 archivos, 0.5 MB) |
| Arrancar desde el paquete simulado, **sin agregarle nada** | ❌ `DriverPackageNotInstalledError` | ✅ `GET /categories` → 200 |
| Base que no responde (`ETIMEDOUT`) | Falla a los 134.5 s | Falla a los 70.7 s |
| Base que rechaza la conexión (`ECONNREFUSED`) | Falla a los 96.3 s | Falla a los 20.1 s |
| Conexiones con `DATABASE_POOL_SIZE=3` y 40 peticiones concurrentes | 10 (fijo) | 3 |
| `pnpm migration:show` con la config compartida | ✅ | ✅ las 3 migraciones aplicadas |

> Los tiempos de arranque incluyen ~30 s que esta máquina tarda solo en
> cargar los módulos de Node (ver el diagnóstico, Paso 3). En Vercel ese costo
> es de pocos segundos, así que la mejora real es mayor: de 9 reintentos de
> 3 s a 2 reintentos de 1 s.

**Para Vercel:** si el proveedor de MySQL exige TLS, definir
`DATABASE_SSL=true`. Para serverless conviene bajar `DATABASE_POOL_SIZE`
(por ejemplo a 3–5), porque cada instancia abre su propio pool.

## Paso 2 — PDF: empaquetado, errores y tamaño de página

**Hallazgos:** 4.1 (Escenario A: canvas y worker de PDF.js fuera del paquete),
4.3 (el error real se descartaba) y 6.1 (páginas de hasta 5 MB, sobre el
límite de 4.5 MB de Vercel).

**Cambios** en `src/reading/content/processors/pdf/pdf-content-processor.service.ts`:

| Cambio | Por qué |
| --- | --- |
| `import '@napi-rs/canvas'` al inicio del archivo | PDF.js lo carga con `createRequire`, que el rastreo no sigue. El import lo hace visible (y entra el binario nativo) y garantiza que se cargue antes que PDF.js. |
| El worker se importa con texto fijo y se registra en `globalThis.pdfjsWorker` | Sin esto PDF.js lo busca con `import(this.workerSrc)`, una ruta calculada. Se carga una sola vez por instancia y, si falla, se permite reintentar. |
| `standardFontDataUrl` y `wasmUrl` calculados con `require.resolve('pdfjs-dist/package.json')` | PDF.js necesita sus fuentes estándar y decodificadores `.wasm`; calcularlos así hace que el rastreo los incluya. |
| Se registra la causa antes de responder 422 | Campo `reason` en el log: la serialización de errores del proyecto oculta los mensajes, así que se agrega aparte. |
| Imagen JPEG (calidad 0.85 → 0.7 → 0.5) en vez de PNG | Se baja la calidad hasta entrar en 4 000 000 caracteres; si ni así entra, `422 La página PDF es demasiado grande para mostrarse`. El cliente recibe igual un data URL en `content`, solo cambia `image/png` por `image/jpeg`. |

Archivos de apoyo: `pdfjs-worker.d.ts` (tipos del worker, que `pdfjs-dist` no
publica) y dos constantes nuevas en `reading-content.constants.ts`.

**Evidencia — qué entra al paquete (`@vercel/nft` sobre `dist/main.js`):**

| Archivo | Antes | Después |
| --- | --- | --- |
| `@napi-rs/canvas` (JS y binario nativo) | ❌ | ✅ |
| `pdfjs-dist/legacy/build/pdf.worker.mjs` | ❌ | ✅ |
| `pdfjs-dist/standard_fonts/` | ❌ | ✅ 16 archivos |
| `pdfjs-dist/wasm/` | ❌ | ✅ 13 archivos |
| Tamaño total del paquete | 12.6 MB | 71.2 MB (límite: 250 MB) |

El paquete crece porque entra `pdfjs-dist` completo (35 MB) y el binario de
canvas (27 MB en Windows, 35 MB el de Linux). Sigue lejos del límite.

**Evidencia — PDFs procesados desde el paquete simulado, sin agregarle nada:**

| PDF | Antes (paquete) | Después (paquete) | Respuesta antes → después |
| --- | --- | --- | --- |
| Artículo de arXiv | ❌ 422 | ✅ 2.2 s | 505 KB → **280 KB** |
| Helvetica sin incrustar | ❌ 422 | ✅ texto dibujado con las fuentes de PDF.js | 4 KB → 7 KB |
| Carta escaneada | ❌ 422 | ✅ | 2.4 MB → **246 KB** |
| Carta con ruido (peor caso) | ❌ 422 (y 4.6 MB en local) | ✅ | 4.6 MB → **877 KB** |
| A3 escaneado | ❌ 422 (y 5.0 MB en local) | ✅ | 5.0 MB → **505 KB** |
| Archivo corrupto | 422 sin causa en el log | 422 y en el log: `Invalid PDF structure.` | — |

- Fondo de la página: la esquina de la imagen es `RGB(255,255,255)`, sin el
  fondo negro que podría aparecer al pasar a JPEG (que no tiene transparencia).
- El aviso `Ensure that the standardFontDataUrl API parameter is provided`
  ya no aparece.

> Para correr el binario de Windows en la simulación hubo que copiar
> `icudtl.dat`; el de Linux no lo necesita (ver el diagnóstico, 4.3).

## Paso 3 — JWT sin expiración

**Hallazgo:** 2.1. `passport-jwt` solo valida `exp` si el token lo trae, así
que un token firmado sin `exp` era válido para siempre.

**Cambio:** `JwtStrategy` y `RefreshJwtStrategy` exigen un `exp` numérico en
la misma validación del `sub`, antes de consultar la base.

**Evidencia — pruebas unitarias** (`auth-infrastructure.spec.ts`, las que ya
existían para esto):

| Prueba | Antes | Después |
| --- | --- | --- |
| *access › requires a valid subject and expiration claim* | ❌ | ✅ |
| *refresh › requires a valid subject and expiration claim* | ❌ | ✅ |

**Evidencia — HTTP real**, con tokens firmados con los secretos del `.env` y
un usuario temporal (borrado al terminar):

| Token | Ruta | Resultado |
| --- | --- | --- |
| Access con `exp` (15 min) | `GET /auth/me` | ✅ 200 |
| Access **sin** `exp` | `GET /auth/me` | ✅ **401** (antes 200) |
| Access con `exp` vencido | `GET /auth/me` | ✅ 401 |
| Refresh con `exp` | `POST /auth/refresh` | ✅ 200 |
| Refresh **sin** `exp` | `POST /auth/refresh` | ✅ **401** (antes 200) |

Los tokens que emite la app siempre traen `exp` (`expiresIn` en el
`JwtModule`), así que las sesiones normales no cambian.

## Paso 4 — Errores de `body-parser` con su código real

**Hallazgo:** 5.1. `HttpExceptionFilter` solo reconocía `HttpException`; los
rechazos que hace Express antes de llegar a Nest (cuerpo demasiado grande,
codificación no soportada) salían como `500 Ha ocurrido un error inesperado`.

**Cambio:** `src/common/filters/http-exception.filter.ts` reconoce los
errores de `http-errors` con `expose: true` y un código 4xx, y responde con
ese código y un mensaje en español según su `type`. Cualquier otro error
sigue respondiendo 500 y se registra igual que antes.

**Evidencia** (app completa con la configuración de `main.ts`):

| Petición | Antes | Después |
| --- | --- | --- |
| JSON de 1 MB (límite de Express: 100 KB) | ❌ 500 | ✅ **413** `El cuerpo de la petición excede el tamaño permitido.` |
| `Content-Encoding` desconocido | ❌ 500 | ✅ **415** `La codificación del cuerpo de la petición no es compatible.` |
| `charset` no soportado | ❌ 500 | ✅ **415** `El juego de caracteres del cuerpo de la petición no es compatible.` |
| JSON mal formado | 400 | 400 (sin cambios: ya lo traducía Nest) |
| Login con credenciales malas (control) | 401 | 401 |
| Ruta inexistente (control) | 404 | 404 |

## Paso 5 — `GET /` y `GET /health`

**Hallazgo:** 2.2. La raíz respondía 404: al abrir la URL del despliegue
parecía que la app estaba caída, y no había ruta de salud.

**Cambio:** nuevo módulo `src/health/` (registrado en `AppModule`) con
`GET /` y `GET /health`. Responden `{ status, service, timestamp }` con
`Cache-Control: no-store`, sin consultar la base ni servicios externos, y
están exentas del throttling (`@SkipThrottle`) para que un monitor no
consuma el límite de nadie.

**Evidencia:**

| Verificación | Resultado |
| --- | --- |
| `GET /` | ✅ 200 `{"status":"ok","service":"bibliolink-backend",…}` (antes 404) |
| `GET /health` | ✅ 200, mismo cuerpo |
| Cabecera `Cache-Control` | ✅ `no-store` |
| 130 × `GET /health` con el límite real (120/min) | ✅ 130 × 200, ningún 429 |
| 130 × `GET /categories` (control) | 120 × 200 y el 429 desde la petición 121: el throttling sigue activo en el resto |

> `GET /health` responde aunque la base falle **después** de arrancar, pero
> no si la app nunca llegó a arrancar (Nest espera la conexión a MySQL antes
> de atender). Por eso sirve para distinguir: si `/health` no responde, el
> problema es el arranque (variables, `mysql2`, base inalcanzable); si
> responde, la app está viva y el error está en una ruta concreta.

## Paso 6 — Importaciones solo para administradores y sin *scaffolds*

**Hallazgo:** 5.2. Las cuatro rutas de importación de `books` se podían
llamar sin sesión (una carga masiva ocupa la función hasta 300 s y hace
cientos de llamadas a APIs externas), y `POST /books`, `PATCH /books/:id` y
`DELETE /books/:id` respondían 200/201 sin hacer nada.

**Cambios:**

| Archivo | Cambio |
| --- | --- |
| `src/books/books.controller.ts` | `POST /books/import`, `/import/search`, `/import/providers/:providerCode` e `/import/all` exigen sesión y rol `ADMIN` (`JwtAuthGuard` + `RolesGuard`). Se quitaron `POST /books`, `PATCH /books/:id` y `DELETE /books/:id`. `GET /books` y `GET /books/:id` siguen públicos. |
| `src/books/books.service.ts` | Se quitaron `create`, `update` y `remove` del *scaffold* (devolvían textos fijos). |
| `src/books/dto/create-book.dto.ts`, `update-book.dto.ts` | Eliminados: eran clases vacías del generador. |
| `src/books/books.module.ts` | Importa `AuthModule` y `PassportModule`, que los guards necesitan en el módulo. |

> **Cambia el contrato de la API.** Si el frontend llamaba a `/books/import`
> con un usuario normal, ahora recibe 403. El camino para un usuario es
> `POST /favorites/external`, que importa una obra puntual si hace falta
> (verificado abajo).

**Evidencia** (tokens firmados con el secreto real; usuarios y libros
temporales borrados al terminar):

| Ruta | Anónimo | `USER` | `ADMIN` |
| --- | --- | --- | --- |
| `POST /books/import` | ✅ 401 (antes 201) | ✅ 403 (antes 201) | ✅ 201 |
| `POST /books/import/search` | ✅ 401 | ✅ 403 | ✅ 201 |
| `POST /books/import/providers/standard-ebooks` | ✅ 401 | ✅ 403 | ✅ 201 |
| `POST /books/import/all` | ✅ 401 | ✅ 403 | ✅ 201 |

| Ruta | Antes | Después |
| --- | --- | --- |
| `POST /books` | 201 `This action adds a new book` | ✅ 404 |
| `PATCH /books/7` | 200 `This action updates a #7 book` | ✅ 404 |
| `DELETE /books/7` | 200 `This action removes a #7 book` | ✅ 404 |
| `GET /books`, `GET /books/7` | 200 | ✅ 200 |
| `POST /favorites/external` como `USER` | 201 | ✅ 201 (importó *Frankenstein*) |

El lint ya no muestra los dos avisos de parámetros sin usar de `books.service.ts`.

## Paso 7 — Cookies entre sitios y `trust proxy`

**Hallazgos:** 7.1 (con frontend y backend en sitios distintos, las cookies
`SameSite=Lax` no viajan y todo da 401 después del login) y 7.2 (sin
`trust proxy`, detrás del proxy de Vercel los usuarios comparten el mismo
contador de throttling).

**Cambios:**

| Archivo | Cambio |
| --- | --- |
| `src/config/envs.ts` | `AUTH_COOKIE_SAME_SITE` (`lax` \| `strict` \| `none`, por omisión `lax`) y `TRUST_PROXY_HOPS` (por omisión `1` si existe la variable `VERCEL`, que Vercel define solo; `0` en cualquier otro lugar). |
| `src/auth/cookies/auth-cookie.service.ts` | Usa el `SameSite` configurado. Con `none` fuerza `Secure`, porque los navegadores descartan `SameSite=None` sin `Secure`. |
| `src/main.ts` | `app.set('trust proxy', envs.trustProxyHops)`: Express toma la IP del cliente de `X-Forwarded-For`, pero solo desde la cantidad de proxies indicada. |

Por omisión el comportamiento local **no cambia**: `SameSite=Lax` y sin
confiar en `X-Forwarded-For` (aceptarla sin un proxy delante permitiría que
un cliente falsee su IP y esquive el throttling).

**Evidencia** — `dist/main.js` real en un proceso aparte, 11 intentos de
login fallidos desde una IP (límite real: 10/min), un intento inmediato desde
otra IP y un login correcto desde una tercera:

| Escenario | Primer 429 (IP 1) | IP 2 justo después | Login correcto (IP 3) | Cookies |
| --- | --- | --- | --- | --- |
| Local (valores por omisión) | intento 11 | 429 — **comparte contador** | 429 — bloqueado por intentos ajenos | — |
| Vercel simulado (`VERCEL=1`) | intento 11 | ✅ 401 — contador propio | ✅ 200 | `HttpOnly; SameSite=Lax` |
| `VERCEL=1` + `AUTH_COOKIE_SAME_SITE=none` | intento 11 | ✅ 401 | ✅ 200 | `HttpOnly; Secure; SameSite=None` |

La primera fila es el comportamiento que había antes en **todos** los
entornos: diez intentos fallidos de cualquiera bloqueaban el login de todos.

**Para Vercel:**

- Si el frontend se sirve desde otro sitio (por ejemplo,
  `bibliolink-front.vercel.app` y `bibliolink-api.vercel.app`, que son sitios
  distintos porque `vercel.app` está en la *Public Suffix List*), definir
  `AUTH_COOKIE_SAME_SITE=none`. Si el frontend redirige `/api` al backend con
  un *rewrite* en su mismo dominio, se puede dejar `lax`.
- `TRUST_PROXY_HOPS` no hace falta definirlo en Vercel.
- El contador sigue siendo **por instancia** (en memoria): con varias
  instancias, cada una cuenta por su lado. Ver *Pendientes*.

## Paso 8 — Versiones de Node y pnpm

**Hallazgo:** 1.1. Sin `engines` ni `packageManager`, Vercel elegía la versión
de Node del proyecto y pnpm 9 o 10 (por el `lockfileVersion: '9.0'`),
mientras el equipo usa Node 22 y pnpm 11.

**Cambio** en `package.json`:

```json
"packageManager": "pnpm@11.1.1",
"engines": { "node": "22.x" }
```

**Evidencia:**

| Verificación | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | ✅ `Already up to date`, con pnpm 11.1.1 |
| `pnpm-lock.yaml` modificado | ✅ No |
| Node local | 22.18 (coincide con `22.x`) |

**Para Vercel:** `engines.node` lo respeta directamente. `packageManager`
**solo se usa si la variable `ENABLE_EXPERIMENTAL_COREPACK=1` está definida**
en el proyecto; sin ella Vercel sigue con pnpm 9/10, lo que hoy no rompe nada
(el lockfile es compatible y `bcrypt` trae binarios precompilados) pero
ignora la opción `allowBuilds` de `pnpm-workspace.yaml`.

## Paso 9 — Pruebas unitarias, e2e y lint

**Hallazgo:** Paso 2 del diagnóstico: `pnpm test` con 6 fallas, la e2e de
ejemplo fallando y 10 avisos de lint.

**Cambios:**

| Archivo | Cambio |
| --- | --- |
| `src/auth/auth-infrastructure.spec.ts` | La simulación de `envs` incluye la sección `cookies`; prueba nueva para `SameSite=None` + `Secure`. |
| `test/app.e2e-spec.ts` | Reemplaza la prueba de ejemplo (`Hello World!`) por `GET /` y `GET /health`, sin base de datos. |
| `src/common/filters/http-exception.filter.spec.ts` (nuevo) | 413, 415, mensaje genérico, 500 para errores no expuestos y `HttpException` de Nest. |
| `src/reading/content/processors/pdf/pdf-content-processor.service.spec.ts` (nuevo) | JPEG con fuentes estándar, páginas inexistentes, registro de la causa y la bajada de calidad hasta entrar en el límite. |
| `vitest.config.ts`, `vitest.config.e2e.ts` | `hookTimeout` y `testTimeout` de 30 s: la prueba de Ads fallaba solo cuando compilar el módulo de Nest pasaba los 10 s por la carga en paralelo. |
| `src/payment_transactions/payment_transactions.controller.ts` | Quitados los imports sin usar (el controller está vacío). |

**Evidencia:**

| Verificación | Antes | Después |
| --- | --- | --- |
| `pnpm test` (corrida 1) | ❌ 6 fallan, 59 pasan | ✅ **76 pasan**, 0 fallan (11 omitidas: las de MySQL) |
| `pnpm test` (corrida 2, para descartar inestabilidad) | — | ✅ 76 pasan, 0 fallan |
| `*.mysql.spec.ts` con `ADS_MYSQL_TESTS=1 ANALYTICS_MYSQL_TESTS=1` | ✅ 11/11 | ✅ 11/11 |
| `pnpm test:e2e` | ❌ 0/1 | ✅ 2/2 |
| `tsc --noEmit` (incluye pruebas) | ✅ 0 errores | ✅ 0 errores |
| `pnpm lint` | 10 avisos | ✅ **0 avisos** |

## Paso 10 — Verificación final con el paquete simulado de Vercel

**Método:** con todas las correcciones, se volvió a rastrear `dist/main.js`
con `@vercel/nft`, se armó la carpeta con **solo** esos archivos (sin agregar
nada a mano) y se corrió la suite de integración HTTP completa del
diagnóstico **cargando la app desde esa carpeta**. La suite se actualizó a
las expectativas nuevas (raíz 200, 413, importaciones de administrador, sin
*scaffolds*). Todo lo creado se borró al terminar.

**Qué entra al paquete:** los 13 elementos que se revisan (PDF.js y su
worker, fuentes estándar, `.wasm`, `@napi-rs/canvas` y su binario, `mysql2`,
`bcrypt`, `yauzl`, `sanitize-html`, `htmlparser2`, `fast-xml-parser`) están
presentes. Tamaño: 71.2 MB de 250 MB.

**Resultado de la suite — 107/107:**

| Módulo | Diagnóstico (proyecto local) | Ahora (paquete simulado de Vercel) |
| --- | --- | --- |
| General | 6/7 | 8/8 |
| Catalogs | 7/7 | 7/7 |
| Auth | 19/19 | 19/19 |
| Books | 12/12 * | 14/14 |
| Categories | 4/4 | 4/4 |
| Users | 12/12 | 12/12 |
| Analytics | 4/4 | 4/4 |
| Favorites | 12/12 | 12/12 |
| Subscriptions | 8/8 | 8/8 |
| Reading | 19/19 | 19/19 |
| **Total** | **103/104** | **107/107** |

\* En el diagnóstico las verificaciones de `books` "pasaban" porque medían el
comportamiento de entonces (importar sin sesión, *scaffolds* respondiendo
201); ahora se exige 401 sin sesión y 404 en los *scaffolds*.

**Casos clave, ahora desde el paquete de Vercel:**

| Caso | Diagnóstico | Ahora |
| --- | --- | --- |
| Arrancar desde el paquete | ❌ `DriverPackageNotInstalledError` | ✅ |
| `GET /` | 404 | ✅ 200 |
| Página 1 de un PDF de arXiv | ❌ 422 (en el paquete) | ✅ 200, `image/jpeg`, 280 KB |
| Página 2 del mismo PDF | ❌ 422 (en el paquete) | ✅ 200, 410 KB |
| Páginas HTML, TEXT y EPUB | ✅ | ✅ |
| JSON de 1 MB | ❌ 500 | ✅ 413 |
| `POST /books/import` sin sesión | 201 | ✅ 401 |
| `POST /books`, `PATCH`/`DELETE /books/7` | 201/200 sin hacer nada | ✅ 404 |

## Resumen

| Hallazgo del diagnóstico | Estado |
| --- | --- |
| 4.2 `mysql2` fuera del paquete | ✅ Corregido (Paso 1) |
| 3.2 Base inalcanzable cuelga el arranque | ✅ Corregido (Paso 1) |
| 4.1 Escenario A: PDF.js sin canvas ni worker | ✅ Corregido (Paso 2) |
| 4.3 Error real del PDF descartado | ✅ Corregido (Paso 2) |
| 6.1 Páginas PDF de más de 4.5 MB | ✅ Corregido (Paso 2) |
| 2.1 JWT sin expiración aceptado | ✅ Corregido (Paso 3) |
| 5.1 Cuerpo grande responde 500 | ✅ Corregido (Paso 4) |
| 2.2 `GET /` 404 y sin ruta de salud | ✅ Corregido (Paso 5) |
| 5.2 Importaciones y *scaffolds* abiertos | ✅ Corregido (Paso 6) |
| 7.1 Cookies `Lax` entre sitios | ✅ Configurable (Paso 7) — hay que definir la variable en Vercel si aplica |
| 7.2 Throttling sin `trust proxy` | ✅ Corregido para la IP del cliente (Paso 7); el contador sigue siendo por instancia |
| 1.1 Node y pnpm sin fijar | ✅ Corregido (Paso 8); pnpm 11 en Vercel requiere Corepack |
| Pruebas en rojo y avisos de lint | ✅ Corregido (Paso 9) |
| 3.1 Variables de entorno faltantes en Vercel | ⚙️ No es código: cargarlas en el panel (lista abajo) |

### Variables de entorno nuevas (todas opcionales)

| Variable | Por omisión | Cuándo cambiarla |
| --- | --- | --- |
| `DATABASE_SSL` | `false` | `true` si el MySQL en la nube exige TLS |
| `DATABASE_POOL_SIZE` | `10` | En Vercel, 3–5: cada instancia abre su propio pool |
| `DATABASE_CONNECT_RETRIES` | `2` | Rara vez |
| `AUTH_COOKIE_SAME_SITE` | `lax` | `none` si el frontend está en otro sitio |
| `TRUST_PROXY_HOPS` | `1` en Vercel, `0` fuera | Solo con otro proxy delante |

Siguen siendo **obligatorias** las 32 del diagnóstico (Hallazgo 3.1). Para
usar pnpm 11 en Vercel, además: `ENABLE_EXPERIMENTAL_COREPACK=1`.

### Cambios que afectan al frontend

- `POST /books/import`, `/import/search`, `/import/providers/:code` e
  `/import/all` ahora exigen rol `ADMIN` (401 sin sesión, 403 con `USER`).
  Un usuario agrega obras con `POST /favorites/external`.
- `POST /books`, `PATCH /books/:id` y `DELETE /books/:id` ya no existen (404).
- Las páginas PDF llegan como `data:image/jpeg;base64,…` en lugar de
  `image/png`. Como `<img src>` funciona igual.
- `GET /` y `GET /health` responden 200.

### Pendientes (no se corrigieron en este trabajo)

| Tema | Por qué queda pendiente |
| --- | --- |
| Throttling por instancia | Un límite global entre instancias necesita un almacenamiento compartido (por ejemplo, Redis): es una decisión de infraestructura. |
| SSE de suscripciones en memoria | Con varias instancias, el aviso puede no llegar. Requiere un canal compartido o cambiar a consultas periódicas a `/subscriptions/membership`. |
| `429` de la API de arXiv | Es un límite del proveedor por IP; en Vercel las IPs son compartidas. Mitigable con caché de búsquedas. |
| EPUB pagina por capítulo | No rompe nada; es una mejora de lectura. |
| `ADMIN` no puede leer | Puede ser intencional; decisión de producto. |
| Licencias de PDFs de arXiv/OpenAlex | Renderizarlos en el servidor choca con los términos de arXiv; decisión de producto. |
| Seed del administrador | Faltan `ROOT_ADMIN_*` en el `.env`; es configuración, no código. |

### Cómo confirmarlo en Vercel

1. Desplegar y abrir `GET /health`: si responde 200, la función arranca.
2. Si no responde, buscar en los logs `Config validation error`,
   `DriverPackageNotInstalledError` o `Unable to connect to the database`.
3. Abrir un libro PDF: debe llegar una imagen `image/jpeg`. Si da 422, el log
   ahora incluye `PDF page processing failed` con el campo `reason`.
4. Iniciar sesión desde el frontend y llamar a `GET /auth/me`: si da 401
   justo después de un login exitoso, falta `AUTH_COOKIE_SAME_SITE=none`.

### Limitaciones de esta verificación

Igual que en el diagnóstico: el empaquetado se simuló con la herramienta de
Vercel pero no se hizo un despliegue real, las pruebas corrieron en Windows
(no en Linux) y el comportamiento de las cookies entre sitios se dedujo del
estándar, sin un navegador real.
