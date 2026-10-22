# Comparación A/B local de Vercel — cierre

Actualizado el 21 de octubre de 2026 (America/Costa_Rica).
Rama: `diagnostic/vercel-nest-integration`.
Base: `766bc41333730d7e1b758771ae12a5b3aa4d82c9`.

**A queda INCOMPLETO; B terminó el build, pero su paquete no es funcionalmente
completo.** `outputDirectory: "dist"` selecciona JavaScript precompilado y conserva
los metadatos. Por sí solo no resuelve las dependencias ausentes.
La causa del error alojado `No exports found` sigue sin demostrarse.

## Recuperación y estado final

Se recuperaron los resultados existentes antes de ejecutar cualquier nueva
compilación. El proceso de A07 ya no estaba activo. La inspección de comandos
del sistema identificó otros procesos Node de otro proyecto; no se detuvieron.
No se reinició ningún build completo durante este cierre.

A07 no dejó `result.json` ni un identificador de proceso recuperable: su código
de salida es **desconocido**, no un fallo de compilación demostrado. Se conservaron
logs y una copia adicional de sus archivos parciales, sin sobrescribir evidencia.

| Intento | Tiempo y resultado observado |
|---|---|
| `ab-build-01`, `ab-build-03` | Subprocesos bloqueados por el sandbox de Windows |
| `ab-build-02/A` | Junction compartida incorrecta: pnpm recreó enlaces del checkout; se restauraron desde el mismo lockfile |
| `ab-build-04/A` | Timeout del harness: 300521 ms; sin Function terminada |
| `ab-build-05/A` | Detenido explícitamente a los 411277 ms al abandonar el modo standalone |
| `ab-build-05/B` | Builder completado, escritura standalone falló con EPERM al crear symlink de cookie-parser: salida 1, 43354 ms |
| `ab-build-06/A` | Modo normal: timeout a los 900344 ms; sin Function final |
| `ab-build-06/B` | Modo normal: salida 0, 40193 ms; CLI informó Build Completed [31s] |
| `ab-build-07/A` | INCOMPLETO: última evidencia a los 1292389 ms (21 min 32,389 s); 76 ciclos iniciados y 75 terminados |

A07 comenzó a `2026-10-21T05:33:15.412Z`; la última escritura del log es
`2026-10-21T05:54:47.801Z`. Ese intervalo es el **tiempo observado hasta el último
log**, no la duración final del proceso. El límite configurado era una hora;
no hay evidencia de que ese timeout llegara a ejecutarse.

Se recuperó el `dist` emitido por Nest y solamente
`.vercel/output/builds.json`. No existe en A07 un `output/config.json` final
ni un `.vc-config.json`. Esto impide comparar dos Functions terminadas.
Los hashes de entradas de aplicación y ajustes locales coinciden con B06.

## Método, seguridad y límites

- CLI 64.0.2, `@vercel/nestjs` 19.0.0, `@vercel/node` 24.0.0,
  `@vercel/build-utils` 14.21.0, Node 24.18.0, TypeScript 6.0.3, pnpm 11.16.0.
- Copias temporales independientes, instalación offline con lockfile y scripts
  de instalación desactivados. No se copiaron .env, credenciales ni .git.
  El proceso recibió valores ficticios y un bloqueo de conexiones.
- Comando: `vercel build --target preview --global-config <directorio vacío>`.
  No hubo pull de ajustes privados, login, despliegue, push, migraciones o seeds.
- Configuración local sintética común: preset nestjs,
  `buildCommand: "pnpm run build"`, `installCommand: ""`, Node 24.x.
  No se afirma que reproduzca todos los ajustes privados de Production.
- B cambia únicamente el archivo temporal a
  `{ "outputDirectory": "dist" }`. El checkout real no recibió vercel.json.
- A07 observó llamadas del compilador en memoria, sin cambiar su emisión ni
  opciones. Esa observación puede añadir sobrecarga: los tiempos no constituyen
  un benchmark controlado.
- El CLI intentó consultar dist-tags; el bloqueo de red rechazó la consulta y
  continuó con paquetes locales. Su mensaje “Using pnpm@9.x” no cambia la versión
  del ejecutable usada en las instalaciones documentadas.
- Los tiempos excluyen la instalación previa y copia de evidencia.
- No se cambió src, main.ts, autenticación, Reading, TypeORM, package.json,
  pnpm-lock.yaml ni versiones. La restauración anterior de enlaces no cambió el
  lockfile; las seis integraciones compiladas pasaron después.
- Los cinco fallos anteriores de autenticación/cookies permanecen fuera del
  alcance. No se reinterpretan como un resultado del A/B.

## Comparación de los artefactos recuperados

| Aspecto | A07: original | B06: outputDirectory dist |
|---|---|---|
| Build Vercel completo | No: INCOMPLETO, salida desconocida | Sí: salida 0 |
| Compilación Nest | dist recuperado | dist y Function conservados |
| Configuración final de salida | Ausente; solamente builds.json | config.json versión 3 |
| Function y .vc-config.json | No generados | functions/index.func/.vc-config.json |
| Handler final | No verificable | dist/main.js |
| Runtime final declarado | No verificable | nodejs24.x, x86_64 |
| AuthService design:paramtypes | Siete tipos en dist de Nest, no en una Function | Siete tipos comprobados en la Function |
| Driver mysql2 | No evaluable como paquete final | Ausente; DataSource lanza DriverPackageNotInstalledError |
| PDF | No evaluable como paquete final | pdf.mjs presente; worker y canvas ausentes |
| Dependencias nativas | No evaluables como paquete final | bcrypt/prebuilds/win32-x64/bcrypt.node |
| Imports literales de la aplicación | No evaluados en Function | Resuelven dentro del paquete; no cubre cargas dinámicas |
| Archivos físicos / tamaño | No hay paquete final comparable | 2844 / 12385592 bytes |
| Diferencia de grafos A/B | NOT RUN | Falta el artefacto A |

El `dist/main.js` recuperado de A tiene SHA-256
`9db83ccc9f2af44741e89a1634ba945e5dac42f8a006e6b898836c4538679f6e`.
AuthService tiene
`c181830de4c3c411f601dca2258014fcf80c3cece9a239390893214abb2595a0`.
Coinciden con los archivos correspondientes empaquetados en B.
Además, B/main, AuthService y el procesador PDF son idénticos byte a byte a
su salida de Nest. No se confunde este resultado con la emisión final del
compilador interno de A, que no llegó a empaquetarse.

B contiene 141 JS de aplicación, 14 entidades, 15 archivos de Reading,
85 emisiones de design:paramtypes y 188 manifiestos de paquetes.
AuthService conserva PinoLogger, JwtService, UsersService,
PasswordHasherService, CaptchaService, EmailService y Repository;
los índices de inyección explícita son [0, 6].

La configuración original de B declara también launcherType Nodejs,
shouldAddHelpers true, shouldAddSourcemapSupport false, framework nestjs,
awsLambdaHandler vacío y environment vacío. Su filePathMap tiene 304 referencias.
No se registran valores de entorno.

El config.json original contiene rutas de error con 404 fuera de /api,
handle filesystem y una ruta /(.*) hacia / con transformación request.path
a /$1; crons está vacío. No hay archivos estáticos. Se conserva el JSON original
para revisar el orden exacto; no se validó este routing mediante una petición alojada.

## Por qué A tarda más

El código instalado de `@vercel/node/dist/index.js`, alrededor de las líneas
72307 y 72600, muestra que el trazador solicita transformar cada TS alcanzado.
La transformación ejecuta getEmitOutput y diagnósticos semánticos/sintácticos.
El builder Nest activa EXPERIMENTAL_NODE_TYPESCRIPT_ERRORS; se habilita además
resolución de módulos por TypeScript. Esta etapa sucede después de nest build.

La configuración raíz usada en esa copia selecciona 194 archivos TS e incluye
specs; tsconfig.build excluye pruebas. Esto amplía el programa que puede revisar
el servicio TypeScript, aunque no significa que todos los specs se empaqueten.
B toma JS precompilado y evita esa segunda transformación de los TS alcanzados.

Está confirmado el trabajo adicional y que A07 avanzó 75 ciclos. **No está
demostrado el cuello de botella exacto**, un bucle infinito ni un import concreto
responsable de los 21 minutos. La traza antigua enviaba varios argumentos a
console.error y el CLI conservó solo el marcador inicial: faltan nombres y
tiempos por archivo. No hubo perfil CPU. No se inventa un archivo problemático.

No podemos afirmar que A sea imposible de completar: no completó los intentos
observados dentro de límites útiles. Si posteriormente se necesita investigar
su rendimiento, conviene perfilar una transformación acotada antes de otro build
completo. Ese perfil no es necesario para constatar los defectos del paquete B.

## Dependencias ausentes: evidencia y causas

### mysql2

La Function B permite importar AppModule y registrar 14 entidades, pero al
construir DataSource con type mysql falla **antes de conectar** con
DriverPackageNotInstalledError. El harness prohíbe resolver módulos fuera de
la Function. Importar TypeORM o sustituir DataSource por un fake no valida el driver.

TypeORM 1.1.1 usa `require(name)` en
`platform/PlatformTools.js:83` y un fallback basado en process.cwd() en :87.
MysqlDriver.loadDependencies solicita mysql2 a través de esa función.
En la instalación actual, mysql2 sí se resuelve desde TypeORM.

Se reprodujo la omisión con el mismo @vercel/nft instalado usado por el builder:
trazar solamente `require('typeorm')` selecciona 364 archivos sin mysql2;
trazar un `require('mysql2')` literal selecciona 147 archivos y sí incluye mysql2.
Esto sustenta una limitación de seguimiento de esa carga dinámica. Los enlaces
pnpm actuales permiten la resolución explícita; no hay prueba de que pnpm sea
por sí solo la causa. Tampoco podemos atribuir la omisión a outputDirectory:
no existe un paquete A terminado para comprobar la diferencia.

### Reading: pdf.worker.mjs y canvas

pdfjs-dist 6.4.299 obtiene require mediante
`process.getBuiltinModule("module").createRequire(import.meta.url)`
en legacy/build/pdf.mjs:15811 y carga canvas en :15813/:15850.
Configura `"./pdf.worker.mjs"` en :22559 e importa el worker mediante una
variable en :22726. Son recursos de ejecución que no quedan garantizados por
el import literal del módulo PDF principal.

La prueba acotada del import de pdf.mjs seleccionó solo tres archivos, sin
worker ni canvas. Una entrada de diagnóstico con imports literales del worker
y de canvas los incorporó al trazado: 13 archivos, incluido el nativo Windows
de canvas. Las entradas de prueba no se ejecutan como aplicación ni modifican
Reading. **Esto demuestra selección por el trazador, no un render funcional.**

La sonda explícita emitió 55 advertencias: dos al intentar interpretar import.meta
como script y 53 de resolución de candidatos opcionales de canvas.
El analizador reintenta como módulo después del intento como script; no hubo
advertencias de parseo como módulo. No se interpreta ese aviso como un rechazo
total del archivo. Los candidatos nativos Linux necesitan verificación propia;
la presencia del candidato Windows no acredita compatibilidad Linux.

No se ejecutó render con el paquete B: falta canvas y el harness rechazó tomarlo
del node_modules externo. También deberán verificarse los assets que realmente
usen los PDFs de prueba, como fuentes, CMaps o WASM; no se declara que todos
sean necesarios ni que estén completos.

### Nativos y Windows

El único .node inventariado en la Function B es el prebuild Windows x64 de
bcrypt. La sonda separada de canvas seleccionó skia.win32-x64-msvc.node.
La Function Linux necesita binarios compatibles con su SO, arquitectura,
libc y Node/N-API. Nada de esto prueba que Production contenga binarios Windows.

El error EPERM de --standalone correspondió a crear un symlink de cookie-parser;
el modo normal sí escribió B. Es un problema local de serialización distinto
de las omisiones de dependencias. No se debe subir este artefacto Windows como
prebuilt para intentar demostrar compatibilidad con Linux.

## Pruebas y clasificación

PASS indica la comprobación concreta, no el éxito integral del backend.
FAIL indica una condición requerida que falló. SKIPPED significa omitida
deliberadamente; NOT RUN significa que no pudo evaluarse por faltar una precondición.

| Comprobación | Estado | Procedencia y alcance |
|---|---|---|
| Recuperación A07 y cotejo de entradas con B | PASS | Archivos reales, hashes y estado de procesos |
| Obtención de Function final A en intentos observados | FAIL | A INCOMPLETO; no equivale a error de compilación demostrado |
| Metadatos Auth en dist parcial A | PASS | Salida real de Nest; no Function |
| Build normal y configuración final B | PASS | Artefacto real emitido por Vercel CLI |
| Siete tipos Auth y tokens explícitos B | PASS | Carga desde Function materializada |
| Import AppModule y registro de 14 entidades B | PASS | Sin inicializar Nest ni conectar a MySQL |
| Resolución de imports literales de aplicación B | PASS | Inventario estático; no prueba cargas dinámicas |
| Construcción DataSource mysql desde B | FAIL | DriverPackageNotInstalledError antes de conexión |
| Presencia worker PDF y canvas en B | FAIL | Archivos/dependencia ausentes |
| Render PDF desde B | NOT RUN | Bloqueado por falta de canvas; no fallback externo |
| Comparación de Functions A/B y dependencias finales A | NOT RUN | No existe Function A |
| Sondas NFT: omisión dinámica/inclusión literal | PASS | Fixtures independientes, no Function ni runtime |
| Integraciones compiladas previas: 6/6 | PASS | Simulación con persistencia sustituida; resultado previo, no repetido en este cierre |
| Compatibilidad bcrypt/canvas en Linux | NOT RUN | Sin artefacto Linux; Docker disponible sin daemon operativo en la comprobación previa |
| Conexión real a MySQL y pruebas con proveedores | SKIPPED | Aislamiento y prohibición de recursos privados/productivos |
| Preview/Production, arranque frío y HTTP alojado | SKIPPED | Sin autorización de despliegue |
| Explicación causal de No exports found | NOT RUN | Faltan excepción original y evidencia del runtime alojado |

## Rutas exactas de evidencia

Todas las rutas relativas parten del repositorio:
`C:\Users\jhonn\Documents\Ciclo II 2026\Aplicaciones Globales\ProyectoGlobales\bibliolink-backend`.

A07:

- `test/diagnostics/results/ab-build-07/A/inputs.json`
- `test/diagnostics/results/ab-build-07/A/started.json`
- `test/diagnostics/results/ab-build-07/A/build.log`
- `test/diagnostics/results/ab-build-07/A/recovery.json`
- `test/diagnostics/results/ab-build-07/A/recovered/dist/main.js`
- `test/diagnostics/results/ab-build-07/A/recovered/dist/auth/auth.service.js`
- `test/diagnostics/results/ab-build-07/A/recovered/.vercel/output/builds.json`

Workspace original A: `C:\Users\jhonn\AppData\Local\Temp\bibliolink-vercel-A-yHMVnR`.
No existen result.json ni las configuraciones finales de Function para este intento.

B06, bajo `test/diagnostics/results/ab-build-06/B/`:

- `inputs.json`, `started.json`, `result.json`, `install.log`, `build.log`.
- `.vercel/output/config.json`.
- `.vercel/output/functions/index.func/.vc-config.json`: original, con filePathMap.
- `materialization.json`: registro de referencias reconstruidas.
- `materialized/.vercel/output/functions/index.func/dist/main.js`: handler inspeccionado.
- `materialized/inspection.json`, `materialized/function-manifest.json`,
  `materialized/packages.json`: inventarios, tamaños y hashes.
- `metadata.json`, `reading.json`, `nest-output-comparison.json`.

Workspace original B: `C:\Users\jhonn\AppData\Local\Temp\bibliolink-vercel-B-K0hI4t`.

La materialización copia únicamente lo seleccionado por el builder y reconstruye
304 referencias como junctions dentro de la propia Function. Elimina filePathMap
solo de su copia de configuración. No añade mysql2 ni canvas. El inventario cuenta
archivos físicos sin duplicar junctions. Las pruebas sobre B bloquean resolución
hacia dependencias del checkout. La salida original queda intacta.

Sondas acotadas, bajo `test/diagnostics/results/trace-03/`:

- `installed.json`: resolución previa de mysql2/canvas y presencia del worker.
- `typeorm-dynamic.cjs`, `mysql-literal.cjs`, `pdf-dynamic.cjs`,
  `pdf-explicit.cjs`: fixtures.
- Archivos homónimos `.json`, `.files.json` y `.log`: mediciones y listas.
- Duraciones respectivas: 1718, 1215, 766 y 2204 ms; límite de 45 s por caso.
- `test/diagnostics/results/trace-warnings-01/pdf-explicit.warnings.json`:
  seguimiento dirigido de advertencias (2270 ms), sin repetir un build.

Las sondas usan la instalación actual del checkout como objeto de trazado,
**no para completar la Function B**. La copia temporal antigua de B presenta
actualmente archivos incompletos de canvas; no hay inventario previo suficiente
para fechar esa condición ni atribuirla al builder. Por eso las sondas separadas
no se presentan como una reconstrucción idéntica de su instalación inicial.
Los intentos fallidos trace-01/trace-02 se preservan.

No se generó comparison.json: compare-ab.cjs requiere dos Functions completas.
results/ está excluido de Git. Scripts añadidos o utilizados únicamente bajo
test/diagnostics: ab-build.cjs, build-offline.cjs, inspect-ab.cjs,
materialize-ab.cjs, ab-metadata.cjs, ab-reading.cjs, compare-ab.cjs,
recover-ab.cjs y trace-dependencies.cjs.

## Propuesta técnica y siguiente experimento mínimo

**dist sigue siendo razonable para seleccionar la salida compilada. No está
validado como solución completa ni listo por sí solo para una Preview funcional.**
Las diferencias demostradas son la entrada JS, su handler y la evitación de la
transformación TS adicional. No está probado que dist introduzca —o corrija—
las omisiones de dependencias respecto de A.

La intervención mínima candidata es de empaquetado: incluir explícitamente
mysql2 **y todas sus dependencias alcanzables**, canvas con su binario correcto,
el worker y los assets PDF necesarios. Vercel documenta
[includeFiles para archivos no detectados](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).
El builder instalado permite configuración de functions para la entrada resuelta,
en B `dist/main.js`. Sus includeFiles agregan archivos, pero no convierten cada
archivo agregado en una nueva raíz de trazado: incluir solo mysql2/index.js
no demuestra que se incluyan sus dependencias.

No se propone copiar todo node_modules ni alterar la arquitectura. Antes de fijar
globs en vercel.json hay que producir un manifiesto de archivos adicionales con
el trazador, preservar rutas/enlaces pnpm y comprobar que los patrones elegidos
copian ese conjunto. Otra opción a evaluar sería una entrada diagnóstica generada
con referencias literales; aún no se ha validado su interacción con la detección
de entrada Nest. No se aplica ninguna de estas opciones en código productivo.

Experimento B’ propuesto, **no ejecutado**:

1. En Linux compatible con el runtime declarado, instalar el mismo lockfile y
   Node 24; conservar inventario previo de dependencias. Variables ficticias,
   sin recursos privados. Usar B como base; no reiniciar A.
2. Preparar una variante de configuración con inclusiones basadas en el
   manifiesto anterior. Comparar B/B’ para aislar el cambio de empaquetado.
   Limitar cada build a cinco minutos; conservar salida parcial si excede el
   límite. No aumentar indefinidamente el plazo.
3. Inspeccionar handler, rutas, metadatos, tamaño y ausencia de binarios Windows.
   Probar dentro del paquete aislado DataSource sin conexión y carga de bcrypt,
   canvas y worker; renderizar un PDF pequeño y otro con fuentes/imágenes.
   Verificar EPUB/HTML/texto según los procesadores existentes.
4. Solo si esas pruebas pasan, presentar diff exacto, inventario, comandos,
   resultados y configuración segura para aprobar una Preview. No enviar
   prebuilt de Windows. Usar base desechable y proveedores sandbox, nunca Aiven
   Production; acceso privado y despliegue requieren autorización expresa.

Riesgos por validar: aumento de tamaño, globs que omitan dependencias transitivas,
rutas pnpm rotas, binarios incompatibles, recursos PDF cargados solo con ciertos
documentos y comportamiento de arranque/routing no cubierto por importar módulos.

## Instrumentación remota propuesta, pendiente de aprobación

Para explicar No exports found hace falta el primer error del proceso alojado,
la fase donde ocurre y el manifiesto/configuración del deployment correspondiente.
La pérdida de metadatos en Vercel Dev/tsx no demuestra esa causa en producción:
el compilador de producción ya conservó metadatos en las pruebas anteriores.
Tampoco las omisiones de B prueban qué contiene la Function hoy desplegada.

Preparar una variante diagnóstica limitada a Preview:

1. Hitos con tiempo e identificador de arranque: entrada, import de módulos,
   bootstrap, NestFactory.create y listen.
2. Captura de imports y de la promesa de bootstrap. Envolver solo el import de
   main no captura el rechazo posterior de void bootstrap().
3. Evaluar abortOnError false únicamente en esa variante para capturar la excepción
   original antes de depender de Pino o de vaciar bufferLogs.
4. Emitir solamente nombre/código seguro, fase y ubicación relativa; en DI,
   provider e índice; en resolución, módulo ausente. No volcar error/cause/message/
   stack completos, variables, SQL, credenciales, JWT, cookies ni payloads.
   Comprobar presencia de mysql2 desde TypeORM antes de conectar.
5. Tras aprobación y con servicios desechables, validar arranque frío y repetido,
   HTTP, autenticación/cookies, rawBody del webhook y Reading.

Esto requiere una propuesta de cambios separada y revisable: no se reescribió
main.ts ni se instrumentó Production. No hay motivo demostrado para cambiar
hosting, sistema de módulos o arquitectura.

Referencias del formato y capacidades:
[NestJS en Vercel](https://vercel.com/docs/frameworks/backend/nestjs),
[Build Output API](https://vercel.com/docs/build-output-api/primitives),
[CLI build](https://vercel.com/docs/cli/build) y
[configuración de functions](https://vercel.com/docs/project-configuration/vercel-json).
Las conclusiones particulares proceden de los artefactos y paquetes inspeccionados;
la documentación general no sustituye validar el runtime alojado.
