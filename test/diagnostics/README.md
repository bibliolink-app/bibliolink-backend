# Diagnóstico BiblioLink / Vercel

Continuación: [comparación A/B de artefactos reales de Vercel](AB-VERCEL.md).
Incluye comprobaciones de empaquetado posteriores a las pruebas de compilador
descritas aquí; un build exitoso no basta para validar sus dependencias dinámicas.

Fecha: 2026-10-20, America/Costa_Rica. Estado: diagnóstico local terminado;
incidente de Production **no resuelto ni reproducido en su runtime alojado**.

## Estado recuperado y alcance

- Rama: `diagnostic/vercel-nest-integration`, creada desde `feature-jhonn`.
- Commit base: `766bc41333730d7e1b758771ae12a5b3aa4d82c9`.
- El árbol estaba limpio al comenzar. Todos los cambios están en `test/diagnostics/`
  y siguen sin commit. `git diff` normal no muestra archivos nuevos sin seguimiento.
- No se modificaron `src`, configuraciones productivas, package.json ni pnpm-lock.yaml.
- No hubo push, despliegue, acceso a recursos privados de Vercel, migraciones,
  seeds ni escrituras sobre Aiven. No se inició `dist/main.js` con el `.env` local.
- Se recuperaron once archivos de diagnóstico y tres logs: `compiled.log`,
  `vercel.log`, `e2e.log`. Los resultados anteriores de Vitest, regresión, build y
  lint estaban en la conversación; no tenían log persistido. No se reconstruyen
  como si fueran logs originales. La continuación añade `compiler-probe.cjs` y este informe.

## Resultado y grado de certeza

| Hallazgo | Clasificación | Evidencia / límite |
|---|---|---|
| `nest build` emite los siete tipos de AuthService | Confirmado | `compiled.test.cjs`, `dist/auth/auth.service.js:231` |
| JwtService se importa como valor y JwtModule se registra | Confirmado | `src/auth/auth.service.ts:7`, `src/auth/auth.module.ts:29` |
| AuthModule y AppModule resuelven sus providers | Confirmado con persistencia simulada | No prueba conectividad ni consultas SQL |
| `/categories` es público | Confirmado | HTTP 200 sin cookies con CategoriesModule y AppModule; fallo ajeno de DI impide arrancar globalmente |
| Vercel Dev usa tsx y pierde los tipos implícitos | Confirmado | Loader de la caché y adaptador oficial, ambos con AuthService real |
| Falta registrar JwtModule o migrar a ESM | Descartado como explicación necesaria del fallo Dev | Los módulos funcionan en CJS compilado; incluso con JwtModule presente, tsx reproduce índice 1 |
| Vitest actual pierde los metadatos | Descartado | Vitest 4.1.11 / Vite 8.2.2 los conserva sin insertarlos manualmente |
| El compilador de build Vercel pierde los mismos metadatos | Descartado en el compilador probado | Se ejecutó el compilador interno real de @vercel/node; no el launcher remoto |
| CLI distinta implica implementación distinta de esos builders | No sustentado | Los archivos comparados son idénticos por SHA256; dependencias y runtime remoto no quedan cubiertos |
| Production no detectó servidor/handler porque bootstrap fue lento o falló | Hipótesis plausible | Main no exporta handler y no espera bootstrap a nivel de módulo; faltan logs/launcher remoto |
| La configuración remota ejecutó exactamente el artefacto que probamos | Pendiente | No hay bundle remoto, configuración efectiva ni launcher de esa invocación |

### Causa demostrada de Dev

`@vercel/nestjs` delega `startDevServer` a `@vercel/node`. Este añade `--import`
con `tsx` al proceso Node. tsx 4.21.0 usa esbuild y no emite los metadatos de tipos
de decoradores. `@InjectPinoLogger` y `@InjectRepository` sí se ejecutan: persisten
los tokens explícitos en las posiciones 0 y 6. Faltan los tipos implícitos de 1–5.
Nest encuentra el primer hueco en `[1]`, que en el código corresponde a JwtService.
La presencia de JwtModule no puede reponer el token de un parámetro ausente.

No se añadieron `@Inject()` a servicios. La prueba negativa que elimina metadatos
solo los altera en memoria y los restaura en `finally`.

Evidencia conservada:

```text
[DI-METADATA compiled] PinoLogger, JwtService, UsersService,
PasswordHasherService, CaptchaService, EmailService, Repository
[official @vercel/node dev adapter] source-entry.ts
  status=503 metadata=null error=UndefinedDependencyException indexOne=true
[official @vercel/node dev adapter] compiled-entry.cjs
  status=200 resolved=true metadata[1]=JwtService
```

El 503 es deliberadamente la respuesta del **fixture diagnóstico** ante el error
de DI, no una reproducción literal de `NO_RESPONSE_FROM_FUNCTION`. El fixture
inicia HTTP inmediatamente y resuelve AuthService al recibir la petición: aísla
la transformación de la detección asíncrona del servidor. No representa todo
AppModule dentro del runtime Vercel ni equivale a Production.

## Investigación independiente de Production

### Selección y transformación de `/var/task/src/main.js`

El preset busca nombres como `src/main.ts` y verifica que el archivo importe
`@nestjs/core`. El builder ejecuta el build configurado y **después vuelve a
descubrir el entrypoint**. Sin `outputDirectory`, encuentra nuevamente `src/main.ts`.
`@vercel/node` traza imports y convierte archivos TS; al construir `NodejsLambda`
renombra la ruta relativa `.ts` a `.js`. Por eso el handler local esperado es
`src/main.js`; `/var/task` es el prefijo observado en el log remoto aportado.

Esto explica esa ruta sin suponer que se ejecutó `dist/main.js`. Ver `Build Completed`
tras `nest build` tampoco demuestra que el runtime use su salida.

La prueba del callback oficial produce:

```text
default=src/main.ts
outputDirectory=dist => dist/main.js
```

La ruta de build usa el compilador TypeScript del proyecto mediante un servicio
de compilación interno; no usa tsx para estos archivos. Para TS 6.0.3 la prueba
ejecutó `register()` real y su camino de language service, con
`EXPERIMENTAL_NODE_TYPESCRIPT_ERRORS=1`, igual que el preset. Se expuso la función
interna añadiendo una exportación **solo a una copia en memoria** del bundle.
No se alteró el paquete instalado.

```text
Using TypeScript 6.0.3 (local user-provided)
src/main.ts => src/main.js
src/auth/auth.service.ts => src/auth/auth.service.js
[build compiler metadata] PinoLogger, JwtService, UsersService,
PasswordHasherService, CaptchaService, EmailService, Repository
```

`results/compiler/` contiene ambos JS emitidos. AuthService se evalúa desde esa
salida, resolviendo sus imports desde `dist` ya validado. Es una prueba real del
compilador y del metadato de esa clase; **no** es una prueba del paquete remoto
completo, de todas sus dependencias empaquetadas ni de la plataforma Linux.

### Qué puede detectar Vercel y cuándo

La documentación oficial del preset acepta un `bootstrap()` que llama
`app.listen()` sin exportar una función. Por tanto, no es correcto concluir que
todo NestJS 12 necesita un handler explícito.

El adaptador Dev inspeccionado acepta funciones exportadas, handlers web y el
servidor capturado interceptando `http.Server.prototype.listen`. Importa el módulo,
desenvuelve defaults y, si no vio servidor, espera hasta 1000 ms adicionales.
Su error final es `Can't detect way to handle request`, **distinto** del mensaje
remoto. No trasladamos su límite de 1000 ms al runtime de Production.

La prueba con el main emitido y un doble acotado de NestFactory registra:

```text
bootstrap:create-start -> module-evaluation-returned -> listen
```

`void bootstrap()` empieza a ejecutarse al evaluar el módulo, pero su Promise
no se exporta ni se espera a nivel superior. La espera de NestFactory incluye
la inicialización de providers y de TypeORM. Si esta espera falla o excede el
criterio de detección del launcher, este puede no encontrar un servidor.

**No conocemos el momento exacto del error remoto**: el log aportado no demuestra
si fallaron imports antes de iniciar bootstrap, si bootstrap seguía esperando,
o si abortó antes de listen. La prueba solo demuestra el orden del entrypoint
cuando sus imports tienen éxito. La frase exacta `No exports found` no aparece
en los bundles de builder/Dev examinados; falta el launcher alojado.

Existe una respuesta de un mantenedor de Vercel de 2020 que relaciona ese mismo
mensaje con `listen()` asíncrono. Es evidencia histórica del mecanismo, no una
especificación del preset actual ni prueba de la causa de esta invocación.

`NODE_OPTIONS=--experimental-require-module` no genera metadatos. El error ESM
anterior y la conectividad/TLS de Aiven permanecen pendientes de evidencia del
entorno remoto; no se cambiaron flags ni configuración de MySQL.

### Comparación de versiones

| Componente | Entorno observado local | CLI remoto reportado / manifiesto público |
|---|---|---|
| Node | 24.18.0 | 24 según contexto; patch efectivo por verificar |
| pnpm | 11.16.0 | 10.28.0 reportado por el usuario |
| Nest core / testing | 12.0.2 / 12.0.1 | Lockfile local; resolución remota por verificar |
| TypeScript | 6.0.3 | Resolución remota por verificar |
| TypeORM | 1.1.1 | Resolución remota por verificar |
| Vitest / Vite | 4.1.11 / 8.2.2 | Solo pruebas locales |
| Vercel CLI | 64.0.2 (caché existente) | 62.7.0 |
| @vercel/nestjs | 19.0.0 | 17.0.0 en manifiesto CLI 62.7.0 |
| @vercel/node | 24.0.0 | 22.0.0 en manifiesto CLI 62.7.0 |
| @vercel/build-utils | 14.21.0 | 14.19.0 en manifiesto CLI 62.7.0 |

Se descargaron los tres tarballs públicos antiguos únicamente para inspección,
en `results/public-packages/`; no se instalaron ni se cambiaron dependencias.
Los siguientes pares son idénticos byte a byte:

| Archivo comparado | SHA256 común |
|---|---|
| @vercel/node 22 y 24 `dist/index.js` | `1bc7bb98d5438924482122317ac969831c570cd07cbfc86229459f013bedafea` |
| @vercel/node 22 y 24 `dist/dev-server.mjs` | `7ea81d8ca4a08df82d2445989fd092d758715b131c03203998c1c5799f302ae9` |
| @vercel/nestjs 17 y 19 `dist/index.js` | `c34cd6022f3b9091628c771e744b38b50c2c19f76e220f254b4aef180185ed01` |
| build-utils 14.19 y 14.21 `dist/generate-node-builder-functions.js` | `61dca49fcd6dee7b42bdb7a1cd14491ff01e5e98a84a415ab32abe0b4b640891` |

Esto compara los paquetes publicados asociados a las CLI. No certifica qué
builder eligió realmente el build remoto ni la identidad de sus dependencias
externas o del launcher gestionado por Vercel.

## Matriz de pruebas

Todos los comandos se ejecutan desde la raíz. `<vercel-node-package>` representa
la ruta absoluta al `package.json` de @vercel/node ya instalado por la CLI.

| Prueba / propósito | Comando | Entorno | Resultado real |
|---|---|---|---|
| Build Nest | `pnpm run build` | Node 24 / TS 6, sin arrancar app | **PASS**, salida 0 |
| Metadatos, DI AuthModule/AppModule, HTTP público y errores, caída global por DI, rawBody PayPal | `pnpm exec node test/diagnostics/run.cjs compiled` | Node, JS de dist, persistencia simulada | **PASS**, 6/6 |
| Metadatos e inyección real de AuthService bajo transformador de pruebas | `pnpm exec node test/diagnostics/run.cjs vitest` | Vitest/Vite actuales | **PASS**, 1/1; resultado previo registrado en conversación |
| Reproducir ausencia de metadatos e índice 1 | `pnpm exec node test/diagnostics/run.cjs tsx <vercel-node-package>` | Loader tsx 4.21.0 de la CLI | **PASS** como prueba negativa: reproduce fallo esperado |
| Callback de entrada y HTTP fuente frente a compilado | `pnpm exec node test/diagnostics/run.cjs vercel <vercel-node-package>` | Adaptador oficial Dev, fixtures | **PASS**, TS falla DI / compilado resuelve |
| Compilador real del builder y orden de bootstrap | `pnpm exec node test/diagnostics/run.cjs compiler <vercel-node-package>` | @vercel/node, TS6; NestFactory simulado solo para orden | **PASS**; conserva JwtService y demuestra retorno anterior a listen |
| Regresión existente | `pnpm exec node test/diagnostics/run.cjs regression` | Vitest, entorno ficticio | **FAIL**: 60 PASS, 5 FAIL, 11 SKIPPED; resultado previo en conversación |
| E2E heredado | `pnpm exec node test/diagnostics/run.cjs e2e` | Vitest, host ficticio 127.0.0.1:1 | **FAIL**: conexión rechazada y cleanup de app no creada |
| Suites MySQL existentes | Incluidas en regression, flags en 0 | Sin daemon Docker disponible | **SKIPPED**, 11 casos; no son PASS |
| Persistencia real de categorías / esquema y fixtures desechables | Pendiente de MySQL desechable y prueba SQL específica | MySQL | **NOT RUN** |
| Lectura de PDF/EPUB/HTML/texto con archivos reales | No existe suite específica en el repositorio | Reading | **NOT RUN**; solo carga e inyección al iniciar AppModule |
| PayPal firma/idempotencia/transacciones reales | Solo se probó frontera HTTP/rawBody | Proveedor / DB | **NOT RUN** |
| Función empaquetada y launcher remotos | Requiere artefacto/entorno autorizado | Production / Preview | **NOT RUN** |
| Lint | `pnpm run lint` | Oxlint, sin autofix | **PASS**, con 10 advertencias previas de imports/parámetros no usados |
| Diff | `git diff --check` y comprobación individual `--no-index --check` | Git | **PASS**, incluidos los nuevos archivos |

Los comandos ejecutados por el agente usaron `node test/diagnostics/run.cjs ...`;
el prefijo `pnpm exec` es la forma equivalente de reproducción con pnpm. El script
lanza el Node actual, usa timeout de 90 s y escribe logs locales sin códigos ANSI.
No ejecutarlo en paralelo con `pnpm run build`, que borra/recrea `dist`.

Incidencias del desarrollo de las pruebas, ya corregidas: una lectura de dist
coincidió con una reconstrucción y falló `MODULE_NOT_FOUND`; el primer supuesto
de que Vitest no emitía metadatos resultó falso; `mergeConfig` concatenó includes
y se sustituyó por composición que conserva los plugins; el fixture de webhook
necesitó importar PassportModule; NODE_OPTIONS requirió normalizar barras en
Windows. Ninguno justifica modificar servicios de producción.

### Cinco fallos previos separados

1. Dos casos, access/refresh: un JWT firmado sin `exp` es aceptado, mientras la
   prueba exige rechazo (`auth-infrastructure.spec.ts:176`). Las estrategias
   validan `sub` y estado; `ignoreExpiration: false` comprueba una expiración
   presente, pero el código no exige que exista `exp`. Es una divergencia real
   respecto a la expectativa de la suite; no una consecuencia del compilador.
2. Dos casos de cookies: el mock `testEnvs` no tiene `cookies.authMaxAge` ni
   `cookies.refreshMaxAge`, que el servicio actual requiere.
3. Un caso de limpieza de cookies: la prueba anterior falla antes de restaurar
   `isProduction=false`, dejando `secure=true` para el siguiente caso. Es un
   fallo de aislamiento encadenado, no evidencia por sí solo de cookies erróneas
   en producción.

No se corrigieron estos cinco casos. Analytics añade metadatos a mano en su prueba
HTTP; esa justificación quedó desactualizada para Vite8 observado. El e2e aún
espera `Hello World!` (`test/app.e2e-spec.ts:23`), pero AppModule devuelve 404 en `/`.
Además su `afterEach` llama `app.close()` aunque el arranque haya fallado.

## Solución mínima propuesta, no aplicada

Recomendación: conservar el monolito, Node24, Nest12 y CommonJS. Primero probar
el preset NestJS con salida compilada seleccionada explícitamente. El callback
de los builders comparados soporta `outputDirectory: "dist"` y encuentra
`dist/main.js` sin cambiar `src/main.ts`.

Cambio concreto propuesto: **crear únicamente `vercel.json`**, sujeto a aprobación
y a confirmar que no hay overrides remotos contradictorios:

```json
{
  "framework": "nestjs",
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist"
}
```

Esta propuesta evita el fallo de metadatos confirmado al usar JS emitido por Nest.
**No se ha demostrado que corrija `No exports found`**: conserva el bootstrap
asíncrono y depende de cómo el runtime alojado detecte el servidor.
`dist` debe existir antes de usarlo en Dev; reconstruirlo después de cambios.

| Alternativa | Evidencia / coste | Decisión |
|---|---|---|
| Preset NestJS + dist explícito | Callback y fixture compilado comprobados; un archivo de configuración | Primera prueba recomendada, pendiente aprobación |
| Corregir/reemplazar transformación de Dev | El problema está en tsx; requiere mecanismo soportado de override o corrección upstream | No inventar opción de Vercel ni cambiar el proyecto a SWC/ESM |
| Handler HTTP explícito con inicialización compartida | Permite que el runtime espere un handler que aguarda bootstrap | Considerar si se confirma fallo de detección asíncrona; mayor cambio, no aplicado |
| Cambiar hosting/modelo de ejecución | Puede eliminar dependencia del launcher serverless, pero agrega operación y migración | No justificado todavía |
| @Inject masivo, migración ESM o downgrade | No repone una cadena de compilación correcta ni explica Production | No recomendado |

Impactos de seleccionar dist:

- Local: scripts Nest y `start:prod` permanecen iguales. Vercel Dev requiere build
  previo; la experiencia de recarga del TS original no queda validada.
- TypeORM: misma configuración, tokens y entidades. No agrega migrationsRun ni
  synchronize. Las migraciones siguen ejecutándose únicamente mediante sus scripts
  explícitos. Falta verificar empaquetado, TLS/conectividad y arranque frío con DB de prueba.
- PayPal: no cambia controller/provider. `rawBody: true` sigue en main. Se verificaron
  los bytes exactos del webhook y rechazo sin cuerpo en Nest local; falta la función
  empaquetada, validación de firma, repetición e idempotencia sobre entorno de prueba.
- Reading: no cambia código ni políticas. AppModule carga sus providers, pero deben
  probarse fixtures PDF/EPUB/HTML/texto, dependencias nativas, imports ESM dinámicos y
  assets dentro del bundle Linux. La carga local no demuestra ese empaquetado.
- Cookies/CORS/pipes/filtro: el entrypoint original permanece. Una futura opción con
  handler explícito tendría que preservar exactamente esas configuraciones, rawBody
  y una única inicialización concurrente de Nest/TypeORM.

## Reproducción y pasos pendientes

Pruebas básicas sin credenciales productivas:

```powershell
pnpm install --frozen-lockfile  # solo si faltan dependencias
pnpm run build
pnpm exec node test/diagnostics/run.cjs compiled
pnpm exec node test/diagnostics/run.cjs vitest
pnpm exec node test/diagnostics/run.cjs regression
pnpm exec node test/diagnostics/run.cjs e2e
pnpm run lint
```

Últimos dos comandos de pruebas pueden fallar por las incidencias descritas.
El runner limpia el entorno heredado, evita `.env`, asigna valores ficticios,
deshabilita suites MySQL optativas y utiliza loopback/puerto 1 para la DB. El guard
adicional sobre `DataSource.initialize` protege el proceso CJS. Vitest puede cargar
TypeORM en otro contexto: el e2e observado intentó loopback y recibió ECONNREFUSED;
no debe describirse como interceptado por ese guard ni como acceso a Aiven.

Con la caché de CLI disponible en este equipo:

```powershell
$vercelNodePackage = 'C:\Users\jhonn\AppData\Local\npm-cache\_npx\69f9afb961c37556\node_modules\@vercel\node\package.json'
pnpm exec node test/diagnostics/run.cjs tsx $vercelNodePackage
pnpm exec node test/diagnostics/run.cjs vercel $vercelNodePackage
pnpm exec node test/diagnostics/run.cjs compiler $vercelNodePackage
```

En otro equipo, usar la ruta real de su CLI, registrar versiones y no aceptar
silenciosamente resultados de otra versión como equivalentes. No se instala CLI
desde las pruebas. La comparación opcional con node22 se marca NOT RUN si no se
descargó su artefacto; la compilación local sigue siendo comprobable.

Para cerrar Production se necesita, sin credenciales ni cuerpos privados:

1. Obtener con autorización el handler/config efectivo, versión de builder/Node,
   launcher y archivos JS de la función que falló. Inspeccionar `.vc-config.json`
   o metadatos equivalentes y la presencia de design:paramtypes en AuthService.
2. Capturar orden de hitos seguros: inicio/fin de imports, inicio de bootstrap,
   final de NestFactory.create, init y listen; registrar duración y tipo/código
   de error sin variables de entorno ni datos de proveedores.
3. Comparar baseline y dist en un entorno aprobado con MySQL desechable. No ejecutar
   `vercel dev` directamente en este checkout usando el `.env` de producción.
4. Autorizar por separado una Preview si se requiere verificar el launcher alojado.
   Probar arranque frío, solicitudes concurrentes y repetidas, `/categories`, errores,
   autenticación, cookies, webhook/rawBody y Reading con datos controlados.
5. Si dist falla al detectar servidor y los metadatos están intactos, aislar la espera
   de TypeORM/bootstrap antes de proponer un handler. No usar un cambio de entrada
   para ocultar una conexión fallida.

MySQL real está pendiente porque `docker info` no encontró el daemon. Se puede
preparar una instancia local independiente cuando Docker esté disponible:

```powershell
docker run --name bibliolink-diagnostic-mysql --rm -d -p 127.0.0.1:33070:3306 -e MYSQL_ROOT_PASSWORD=diagnostic-only -e MYSQL_DATABASE=bibliolink_diagnostic mysql:8.4
docker exec bibliolink-diagnostic-mysql mysqladmin ping -pdiagnostic-only
```

Son instrucciones **no ejecutadas**. Antes de correr consultas de categorías se
debe añadir una suite específica con schema/fixtures propios y conexión explícita
a esa instancia. Los mocks actuales no verifican SQL, constraints ni transacciones.
No habilitar los flags MySQL existentes con el `.env` productivo.

## Archivos y revisión

| Archivo nuevo | Propósito |
|---|---|
| `environment.cjs` | Entorno ficticio antes de imports y guard adicional CJS |
| `run.cjs` | Comandos reproducibles, aislamiento de env, timeout y logs |
| `compiled.test.cjs` | Seis integraciones sobre dist, incluido rawBody |
| `metadata.probe.ts` | Metadatos del transformador Vitest real |
| `vitest.config.mts` | Reutiliza plugins existentes y limita esta suite |
| `source-probe.cjs` | Reproducción de DI con el tsx de Vercel |
| `runtime-fixture.cjs` | HTTP diagnóstico que resuelve AuthService real |
| `fixtures/source-entry.ts` | Entrada TS para el adaptador Dev |
| `fixtures/compiled-entry.cjs` | Entrada equivalente que carga dist |
| `vercel-runtime.cjs` | Callback oficial y ejecución del adaptador Dev |
| `compiler-probe.cjs` | Compilador real de build, metadatos y orden del main |
| `.gitignore` | Excluye resultados regenerables y paquetes públicos |
| `README.md` | Informe, resultados y propuesta no aplicada |

Los logs y JS emitidos están bajo `results/` y no se versionan. El diff completo
de archivos nuevos se entrega en `results/diagnostic.patch`; no modifica el índice.
No se alteró código existente para hacer pasar las pruebas.

## Fuentes y puntos precisos de inspección

- [NestJS en Vercel: detección y ejemplo con listen](https://vercel.com/docs/frameworks/backend/nestjs).
- [Limitación de emitDecoratorMetadata en esbuild](https://esbuild.github.io/content-types/#typescript).
- [Vite 8 usa Oxc/Rolldown](https://vite.dev/guide/migration.html).
- [Fork del servidor Dev](https://github.com/vercel/vercel/blob/main/packages/node/src/fork-dev-server.ts).
- [Compilador de TypeScript del builder](https://github.com/vercel/vercel/blob/main/packages/node/src/typescript.ts).
- [Construcción de la función](https://github.com/vercel/vercel/blob/main/packages/node/src/build.ts).
- [Adaptador Dev y captura de listen](https://github.com/vercel/vercel/blob/main/packages/node/src/serverless-functions/serverless-handler.mts).
- [Manifiesto público CLI 62.7.0](https://registry.npmjs.org/vercel/62.7.0).
- [Respuesta histórica del mantenedor, 2020](https://github.com/vercel/vercel/discussions/4333).

Las referencias a `main` upstream son contexto vigente, no sustituyen la inspección
versionada. En los paquetes locales comparados: Nest `dist/index.js:38` (detección),
`:72` (delegación Dev); build-utils `dist/generate-node-builder-functions.js:97`
(outputDirectory); Node `dist/index.js:72159` (register), `:72625` (compilación),
`:72928` (handler), `:73039` (NodejsLambda), `:73147` (tsx);
`dist/dev-server.mjs:1158` (listen), `:1214` (espera Dev).

La evidencia permite recomendar y probar una corrección mínima del problema Dev.
La causa raíz concreta de la invocación de Production continúa pendiente.
