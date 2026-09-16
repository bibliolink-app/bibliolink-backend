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
