# BiblioLink Backend

Backend de BiblioLink desarrollado con NestJS, TypeScript y MySQL.

## Tecnologías

- NestJS
- TypeScript
- MySQL
- REST API
- JWT

## Arquitectura

Monolito modular.

## Módulos previstos

- Autenticación
- Usuarios
- Catálogo
- Favoritos
- Lectura
- Suscripciones
- Pagos
- Publicidad
- Integraciones externas

## Identificadores de usuario

Política acordada para las futuras consultas y escrituras de usuarios:

- Email: eliminar whitespace exterior con `trim()` y convertir a minúsculas con
  `toLowerCase()` antes de buscar o persistir. Se considera un identificador
  único sin distinguir mayúsculas. Se mantienen `IsEmail` y el máximo de 254
  caracteres.
- Username: eliminar whitespace exterior con `trim()`, conservar las mayúsculas
  y minúsculas para representación y exigir unicidad sin distinguirlas.
  `Jhonn` y `jhonn` representan el mismo identificador. El máximo es de 25
  caracteres.
- La canonicalización será responsabilidad del servicio de Users antes de
  acceder a su repository, tanto en búsquedas como en futuras escrituras, para
  aplicar la misma regla al registro público y a la creación administrativa.
  Auth consumirá esa API pública; el DTO se limita a validar el contrato HTTP.
- La unicidad concurrente deberá estar respaldada por índices `UNIQUE` completos
  y una collation case-insensitive adecuada en ambas columnas. Una consulta
  previa a la inserción no sustituye esa garantía.

Esta política aún no está implementada: `findByEmail` y `findByUsername` pasan
sus argumentos a TypeORM sin canonicalización ni comparación case-sensitive
explícita. La comparación depende de la collation de cada columna. No se añaden
columnas normalizadas ni cambios de esquema anticipados.

La entidad declara ambas columnas únicas, pero el repositorio no contiene
migraciones o DDL que acrediten el esquema físico ni configura su collation.
La inspección de MySQL del Paso 3.5 falló con `ER_BAD_DB_ERROR` para la base
configurada. Deben comprobarse el charset, las collations y los índices reales
antes de decidir si hace falta una migración. También debe evaluarse si la
collation elegida considera equivalentes acentos u otros caracteres, además de
mayúsculas y minúsculas.

Antes de habilitar el registro debe resolverse el orden de validación de emails
con whitespace exterior: actualmente `IsEmail` los rechaza en `ValidationPipe`
antes de que llegue a ejecutarse el servicio. Para aceptarlos conforme a esta
política habrá que definir un procesamiento explícito previo a la validación,
manteniendo la canonicalización del servicio como autoridad final. Este paso
no modifica el DTO ni incorpora ese procesamiento.

Una fecha de nacimiento futura deberá evaluarse como regla de validez del
registro cuando se implemente ese caso de uso. No hay una edad mínima o máxima
definida en esta etapa.

## Proveedores de contenido (módulo `catalogs`)

El módulo `catalogs` concentra la integración con las APIs públicas de las que
BiblioLink obtiene su contenido. Cada proveedor implementa la interfaz
`BookCatalogProvider` y devuelve un `ExternalBook`, una forma uniforme cuyos
campos corresponden a las entidades `Book`, `BookAuthor` y `BookLanguage`.

| Código | API | Referencia externa | Portada | Contenido |
| --- | --- | --- | --- | --- |
| `gutendex` | Gutendex (Project Gutenberg) | Id numérico (`345`) | Sí | HTML o epub |
| `standard-ebooks` | Standard Ebooks (feed OPDS 2.0) | `autor/titulo` | Sí | epub o XHTML |
| `arxiv` | arXiv (feed Atom) | Id sin versión (`2306.04338`) | No | PDF |
| `openalex` | OpenAlex | Id de trabajo (`W2101234009`) | No | Enlace de acceso abierto |

Particularidades de cada integración:

- **Gutendex** impone un tamaño de página fijo de 32 obras y se suspende cuando
  no recibe tráfico, por lo que usa un tiempo límite mayor que el general.
- **Standard Ebooks** no publica una API REST. Su feed OPDS responde JSON
  cuando se solicita con `Accept: application/opds+json`. No informa el total
  de coincidencias ni permite consultar una obra por identificador, así que el
  detalle se resuelve buscando y confirmando la referencia exacta. Su sitio
  tiene enlaces trampa contra rastreadores: nunca debe leerse su HTML.
- **arXiv** pide un intervalo de tres segundos entre llamadas, por lo que las
  consultas se encolan y se espacian de forma automática. No publica portadas
  ni el idioma de cada artículo, así que se asume `en`.
- **OpenAlex** entrega el resumen como índice invertido y se reconstruye antes
  de exponerlo. Las peticiones incluyen `mailto` para entrar en su cola
  preferente.

Los idiomas se normalizan al subtag principal en minúsculas (`en-GB` se guarda
como `en`) para que coincidan con la tabla `languages`.

### Endpoints

- `GET /catalogs/providers` — proveedores registrados y su estado.
- `GET /catalogs/search?query=&provider=&language=&page=&pageSize=` — busca en
  el proveedor indicado o, si se omite, en todos los que estén activos. La
  caída de una API no interrumpe la búsqueda: su código se informa en
  `unavailableProviders`.
- `GET /catalogs/providers/:providerCode/book?reference=` — detalle de una obra.

Parámetros de `search`:

| Parámetro | Obligatorio | Valor por omisión | Descripción |
| --- | --- | --- | --- |
| `query` | No | vacío | Texto a buscar, hasta 200 caracteres. arXiv lo exige: sin él devuelve una página vacía. |
| `provider` | No | todos los activos | Uno de `gutendex`, `standard-ebooks`, `arxiv`, `openalex`. |
| `language` | No | sin filtro | Código de idioma. Solo lo aplican Gutendex y OpenAlex. |
| `page` | No | `1` | Número de página, desde 1. |
| `pageSize` | No | `20` | Entre 1 y 50. Gutendex lo ignora: siempre devuelve 32 por página. |

#### Ejemplos de uso

**Listar los proveedores registrados**

```bash
curl http://localhost:3000/catalogs/providers
```

```json
[
  { "providerId": 3, "code": "arxiv", "name": "arXiv", "active": true },
  { "providerId": 4, "code": "openalex", "name": "OpenAlex", "active": true },
  { "providerId": 1, "code": "gutendex", "name": "Project Gutenberg (Gutendex)", "active": true },
  { "providerId": 2, "code": "standard-ebooks", "name": "Standard Ebooks", "active": true }
]
```

**Buscar en todos los proveedores activos**

```bash
curl "http://localhost:3000/catalogs/search?query=dracula&pageSize=2"
```

Cada proveedor aporta su propia página de resultados. En el ejemplo se muestra
solo la primera obra de cada uno y las descripciones van recortadas:

```json
{
  "query": "dracula",
  "page": 1,
  "pageSize": 2,
  "results": [
    {
      "providerCode": "gutendex",
      "items": [
        {
          "providerCode": "gutendex",
          "externalReference": "345",
          "title": "Dracula",
          "description": "\"Dracula\" by Bram Stoker is a Gothic horror novel published in 1897.",
          "coverUrl": "https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg",
          "contentReference": "https://www.gutenberg.org/ebooks/345.html.images",
          "authors": ["Bram Stoker"],
          "languageCodes": ["en"]
        }
      ],
      "page": 1,
      "pageSize": 32,
      "totalItems": 5,
      "hasNextPage": false
    },
    {
      "providerCode": "standard-ebooks",
      "items": [
        {
          "providerCode": "standard-ebooks",
          "externalReference": "bram-stoker/dracula",
          "title": "Dracula",
          "description": "An ancient undead monster terrorizes Victorian London.",
          "coverUrl": "https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/cover.jpg",
          "contentReference": "https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula.epub?source=feed",
          "authors": ["Bram Stoker"],
          "languageCodes": ["en"]
        }
      ],
      "page": 1,
      "pageSize": 2,
      "totalItems": null,
      "hasNextPage": false
    },
    {
      "providerCode": "openalex",
      "items": [
        {
          "providerCode": "openalex",
          "externalReference": "W4249704141",
          "title": "Dracula",
          "description": "'It was butcher work...the horrid screeching as the stake drove home'",
          "coverUrl": null,
          "contentReference": "https://doi.org/10.1093/owc/9780199564095.001.0001",
          "authors": ["Bram Stoker"],
          "languageCodes": ["en"]
        }
      ],
      "page": 1,
      "pageSize": 2,
      "totalItems": 15729,
      "hasNextPage": true
    }
  ],
  "unavailableProviders": ["arxiv"]
}
```

`totalItems` en `null` significa que esa API no publica el total de
coincidencias, como ocurre con Standard Ebooks. `unavailableProviders` lista
los proveedores que no respondieron: la búsqueda igual devuelve `200` con los
resultados de los demás.

**Buscar en un solo proveedor y filtrar por idioma**

```bash
curl "http://localhost:3000/catalogs/search?query=quijote&provider=gutendex&language=es&pageSize=5"
```

**Pedir la página siguiente**

```bash
curl "http://localhost:3000/catalogs/search?query=machine+learning&provider=arxiv&page=2&pageSize=10"
```

**Ver el detalle de una obra**

La referencia es la que devuelve la búsqueda en `externalReference`. Conviene
codificarla, porque la de Standard Ebooks lleva una barra:

```bash
curl "http://localhost:3000/catalogs/providers/standard-ebooks/book?reference=bram-stoker%2Fdracula"
```

```json
{
  "providerCode": "standard-ebooks",
  "externalReference": "bram-stoker/dracula",
  "title": "Dracula",
  "description": "An ancient undead monster terrorizes Victorian London.",
  "coverUrl": "https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/cover.jpg",
  "contentReference": "https://standardebooks.org/ebooks/bram-stoker/dracula/downloads/bram-stoker_dracula.epub?source=feed",
  "authors": ["Bram Stoker"],
  "languageCodes": ["en"]
}
```

Otras referencias válidas: `345` en `gutendex`, `2306.04338` en `arxiv` y
`W2101234009` en `openalex`.

#### Errores

| Código | Cuándo ocurre |
| --- | --- |
| `400` | Parámetros inválidos: un `provider` desconocido, `pageSize` fuera de rango o un parámetro no permitido. |
| `404` | El proveedor está desactivado en `book_providers`, o la referencia no existe en esa API. |
| `500` | Error de base de datos. Si es un `QueryFailedError` en `/catalogs/providers`, casi siempre falta la tabla `book_providers`. |
| `503` | La API externa no respondió a tiempo o devolvió un estado de error. |

### Registro en la base de datos

Los cuatro proveedores se registran en `book_providers` al ejecutar el seed. El
sembrador es idempotente: solo agrega los que falten y no modifica el campo
`active` de los que ya existan.

### Variables de entorno

- `CATALOG_CONTACT_EMAIL` — correo con el que BiblioLink se identifica ante las
  APIs externas. Por omisión, `soporte@bibliolink.app`.
- `CATALOG_REQUEST_TIMEOUT_MS` — tiempo límite general de las llamadas
  externas. Por omisión, `10000`.

## Catálogo local (módulo `books`)

`catalogs` solo consulta APIs externas: no guarda nada. `books` es el índice
propio de BiblioLink — la copia local de metadatos que sigue disponible aunque
el proveedor esté caído, y a la que se enganchan `favorites` y `reading`
mediante un `book_id` estable que no depende del formato de referencia de
cada proveedor.

Se guardan **solo metadatos** (título, descripción, autores, idiomas, URL de
portada y enlace de contenido), nunca el archivo completo. Es una distinción
deliberada: Gutendex y Standard Ebooks permiten mirror completo (contenido de
dominio público o CC0), pero **arXiv prohíbe explícitamente** alojar sus PDFs
en un servidor propio sin permiso del autor, y **OpenAlex** enlaza casi
siempre a un PDF de un repositorio o editorial ajena cuyo copyright BiblioLink
no tiene. Por eso `contentReference` y `coverUrl` siempre quedan como enlaces
al proveedor original, nunca como archivos copiados.

### Cómo se guarda una obra

Cada importación es una única transacción sobre tres tablas:

1. **`books`** — se busca por `(provider_id, external_reference)`; si existe
   se actualiza (`título`, `descripción`, `portada`, `contenido`), si no,
   se crea. Esto es lo que evita duplicar una obra que vuelve a aparecer en
   una búsqueda posterior.
2. **`book_authors`** — se reemplaza la lista completa en el orden que
   entrega el proveedor (`author_order` empieza en 1).
3. **`book_languages`** y **`languages`** — por cada código de idioma se crea
   primero la fila en `languages` si no existe (usando una tabla de nombres
   fija en [language-names.ts](src/books/data/language-names.ts); un código
   sin nombre conocido no rompe la importación, se guarda como
   `Unknown (xx)`), y luego se reemplaza la lista de idiomas de la obra.

Una carrera entre dos importaciones simultáneas de la misma obra no falla: se
detecta el `ER_DUP_ENTRY` y se recupera la fila que ganó, igual que en el
resto del proyecto (`isMySqlUniqueViolation`).

### Endpoints

- `POST /books/import` — trae una obra puntual de un proveedor (mismos datos
  que devuelve `catalogs`) y la guarda. Body: `{ providerCode, externalReference }`.
- `POST /books/import/search` — ejecuta una búsqueda en `catalogs` (mismo
  body que `GET /catalogs/search`: `query`, `provider?`, `language?`, `page`,
  `pageSize`) y guarda cada obra que devuelva. Así se puebla `books` con lo
  que ofrecen los proveedores sin depender de que un usuario favorite algo
  primero.
- `POST /books/import/providers/:providerCode` — carga masiva: guarda **todas**
  las obras de un único proveedor, avanzando página a página hasta agotarlas
  o hasta `maxPages`. Body opcional: `{ query?, language?, pageSize?, maxPages? }`.
- `POST /books/import/all` — carga masiva: igual que la anterior, pero para
  **todos los proveedores activos**. Los desactivados se omiten en silencio.
- `GET /books` — lista lo que ya está guardado localmente.
- `GET /books/:id` — detalle de una obra guardada, por su `book_id` interno.

#### Ejemplos de uso

**Importar una obra puntual**

```bash
curl -X POST http://localhost:3000/books/import \
  -H "Content-Type: application/json" \
  -d '{"providerCode":"gutendex","externalReference":"345"}'
```

```json
{
  "bookId": 1,
  "providerId": 1,
  "providerCode": "gutendex",
  "externalReference": "345",
  "title": "Dracula",
  "description": "\"Dracula\" by Bram Stoker is a Gothic horror novel published in 1897...",
  "coverUrl": "https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg",
  "contentReference": "https://www.gutenberg.org/ebooks/345.html.images",
  "authors": ["Bram Stoker"],
  "languages": [{ "languageCode": "en", "name": "English" }],
  "createdAt": "2026-09-27T18:08:35.083Z",
  "updatedAt": "2026-09-27T18:08:35.083Z"
}
```

Repetir la misma llamada no duplica el libro: devuelve el mismo `bookId` con
los metadatos actualizados.

**Importar todo lo que arroje una búsqueda**

```bash
curl -X POST http://localhost:3000/books/import/search \
  -H "Content-Type: application/json" \
  -d '{"query":"dracula","pageSize":2}'
```

```json
{
  "query": "dracula",
  "page": 1,
  "pageSize": 2,
  "imported": [
    { "providerCode": "gutendex", "externalReference": "345", "title": "Dracula", "bookId": 1, "status": "created" },
    { "providerCode": "standard-ebooks", "externalReference": "bram-stoker/dracula", "title": "Dracula", "bookId": 2, "status": "created" },
    { "providerCode": "arxiv", "externalReference": "2604.23815", "title": "DRACULA: Hunting for the Actions Users Want Deep Research Agents to Execute", "bookId": 3, "status": "created" },
    { "providerCode": "openalex", "externalReference": "W4249704141", "title": "Dracula", "bookId": 4, "status": "created" }
  ],
  "failed": [],
  "unavailableProviders": []
}
```

Un proveedor caído no interrumpe a los demás: aparece en
`unavailableProviders` y el resto se importa igual. Una obra puntual que
falle al guardarse (por ejemplo, un dato que viole una restricción) tampoco
frena a las otras: aparece en `failed` con el motivo.

**Carga masiva: todas las obras de un proveedor**

Sin `query`, cada proveedor que admite listar su catálogo completo
(Gutendex, Standard Ebooks, OpenAlex) lo recorre desde el principio; **arXiv
no admite listar sin filtro** y con `query` vacío no devuelve nada, porque su
API no ofrece un endpoint de listado completo (solo búsqueda).

```bash
curl -X POST http://localhost:3000/books/import/providers/standard-ebooks \
  -H "Content-Type: application/json" \
  -d '{"query":"shelley","pageSize":3,"maxPages":4}'
```

```json
{
  "query": "shelley",
  "pageSize": 3,
  "maxPages": 4,
  "pagesFetched": 4,
  "imported": [
    { "providerCode": "standard-ebooks", "externalReference": "mary-shelley/the-last-man", "title": "The Last Man", "bookId": 12, "status": "created" },
    { "providerCode": "standard-ebooks", "externalReference": "mary-shelley/frankenstein", "title": "Frankenstein", "bookId": 13, "status": "created" }
  ],
  "failed": [],
  "unavailableProviders": [],
  "truncated": true
}
```

`truncated: true` significa que el proveedor todavía tenía más resultados
cuando se llegó a `maxPages`; subir ese valor trae más. `maxPages` tiene un
tope duro de 500 páginas para que nadie dispare sin querer una corrida de
horas — Gutendex ronda las 75 000 obras y OpenAlex indexa cientos de millones,
así que "traer todo, todo" de esos dos requiere subir el límite a propósito y
con paciencia, no es el valor por omisión (20 páginas).

Contra un proveedor desactivado en `book_providers`, este endpoint falla de
inmediato con `404`, igual que `POST /books/import`: una carga masiva pedida
explícitamente para un proveedor concreto no lo recorre igual si un
administrador lo apagó.

**Carga masiva: todos los proveedores activos**

```bash
curl -X POST http://localhost:3000/books/import/all \
  -H "Content-Type: application/json" \
  -d '{"query":"poe","pageSize":3,"maxPages":2}'
```

```json
{
  "query": "poe",
  "pageSize": 3,
  "maxPages": 2,
  "pagesFetched": 4,
  "imported": [
    { "providerCode": "openalex", "externalReference": "W2143932682", "title": "Poe, Poe, Poe, Poe, Poe, Poe, Poe.", "bookId": 46, "status": "created" },
    { "providerCode": "standard-ebooks", "externalReference": "edgar-allan-poe/short-fiction", "title": "Short Fiction", "bookId": 11, "status": "created" }
  ],
  "failed": [],
  "unavailableProviders": ["gutendex"],
  "truncated": true
}
```

A diferencia de `POST /books/import/search`, aquí los proveedores
desactivados **no** producen error: se omiten en silencio, porque es una
carga masiva sobre "todo lo disponible", no un pedido a un proveedor puntual.
Uno que sí está activo pero no responde (como `gutendex` en el ejemplo, que
se suspende por inactividad) sigue apareciendo en `unavailableProviders` sin
frenar a los demás. Los proveedores se recorren de a uno, nunca en paralelo,
para no golpear las cuatro APIs externas a la vez.

**Ver lo que ya está guardado**

```bash
curl http://localhost:3000/books
curl http://localhost:3000/books/1
```

#### Errores

| Código | Cuándo ocurre |
| --- | --- |
| `400` | Body inválido: `providerCode` desconocido, referencia vacía, `maxPages`/`pageSize` fuera de rango, u otro parámetro fuera de rango. |
| `404` | `GET /books/:id` con un id que no existe, o una importación (puntual o masiva de un proveedor) contra un proveedor desactivado o una referencia que no existe. |
| `503` | El proveedor externo no respondió a tiempo durante una importación puntual. |

Nota: por ahora estos endpoints no tienen guardias de autenticación, igual
que el resto de `catalogs` y `books`. Antes de exponerlos en producción,
`POST /books/import/search` en particular conviene restringirlo a un rol
administrativo, ya que puede disparar varias llamadas a APIs externas por
cada ejecución.

## Favoritos (módulo `favorites`)

Cada usuario guarda obras de `books` en sus favoritos, con un límite que
depende de su plan:

| Plan | Límite | Cuándo aplica |
| --- | --- | --- |
| `FREE` | 3 | Sin suscripción vigente. |
| `PREMIUM` | 50 | `SubscriptionsService.hasPremiumAccess()` es verdadero: una suscripción `ACTIVE`, o `CANCELED` cuyo período pagado todavía no venció. |

El plan **no se guarda en ninguna tabla**: se calcula en cada operación a
partir de la suscripción. Así, una suscripción que se activa, vence o se
cancela se refleja de inmediato, sin sincronizar nada. Los límites están en
[favorites.constants.ts](src/favorites/constants/favorites.constants.ts).

Reglas:

- **Bajar de plan no borra favoritos.** Un usuario Premium con 40 favoritos
  cuya suscripción vence los conserva todos, pero no puede agregar más hasta
  quitar los suficientes para quedar por debajo de 3.
- **Sin duplicados.** La restricción `UQ_favorites_user_book` impide guardar
  la misma obra dos veces; el servicio responde `409`.
- **Sin carreras.** El alta bloquea la fila del usuario (`pessimistic_write`,
  el mismo patrón que `reservePendingSubscription`), así que dos solicitudes
  simultáneas no pueden pasar ambas el control del límite.
- **Siempre del usuario autenticado.** Todas las rutas usan `JwtAuthGuard` y
  toman el `userId` del token, nunca del cuerpo ni de la URL.

### Endpoints

Todos requieren sesión iniciada (cookie `access_token`).

- `GET /favorites` — favoritos del usuario, del más reciente al más antiguo,
  con el plan y los espacios que le quedan.
- `POST /favorites` — agrega una obra que ya está en `books`. Body: `{ bookId }`.
- `POST /favorites/external` — agrega una obra tal como viene de
  `GET /catalogs/search`. Body: `{ providerCode, externalReference }`. Si la
  obra ya está en `books` usa esa copia, sin consultar al proveedor; si no,
  la importa primero.
- `DELETE /favorites/books/:bookId` — quita una obra de favoritos. Responde `204`.

#### Ejemplos de uso

**Agregar desde un resultado del catálogo**

```bash
curl -X POST http://localhost:3000/favorites/external \
  -b "access_token=<token>" \
  -H "Content-Type: application/json" \
  -d '{"providerCode":"gutendex","externalReference":"1342"}'
```

```json
{
  "favoriteId": 5,
  "bookId": 63,
  "progressPercent": 0,
  "readingLocation": null,
  "addedAt": "2026-10-01T15:17:42.118Z",
  "lastReadAt": null,
  "book": {
    "bookId": 63,
    "providerId": 1,
    "providerCode": "gutendex",
    "externalReference": "1342",
    "title": "Pride and Prejudice",
    "description": "...",
    "coverUrl": "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
    "contentReference": "https://www.gutenberg.org/ebooks/1342.html.images",
    "authors": ["Jane Austen"],
    "languages": [{ "languageCode": "en", "name": "English" }],
    "createdAt": "2026-10-01T15:17:41.902Z",
    "updatedAt": "2026-10-01T15:17:41.902Z"
  }
}
```

**Ver los favoritos y el límite**

```bash
curl http://localhost:3000/favorites -b "access_token=<token>"
```

```json
{
  "plan": "FREE",
  "limit": 3,
  "count": 3,
  "remaining": 0,
  "items": [
    { "favoriteId": 5, "bookId": 63, "progressPercent": 0, "readingLocation": null, "addedAt": "2026-10-01T15:17:42.118Z", "lastReadAt": null, "book": { "title": "Pride and Prejudice" } }
  ]
}
```

En los ejemplos, `description` y `book` van recortados; la respuesta real trae la obra completa,
igual que en `POST`.

**Quitar un favorito**

```bash
curl -X DELETE http://localhost:3000/favorites/books/63 -b "access_token=<token>"
```

#### Errores

| Código | Cuándo ocurre |
| --- | --- |
| `400` | `bookId` no es un entero positivo, o `providerCode`/`externalReference` inválidos. |
| `401` | Sin sesión, token vencido o cuenta inactiva. |
| `403` | Se alcanzó el límite del plan. El mensaje indica el límite y, si es `FREE`, que Premium permite 50. |
| `404` | El libro no existe, la referencia no existe en el proveedor, o se intenta quitar un libro que no está en favoritos. |
| `409` | El libro ya está en favoritos. |
| `503` | `POST /favorites/external` tuvo que importar la obra y el proveedor no respondió. |
