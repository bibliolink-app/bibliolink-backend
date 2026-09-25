# Métricas administrativas

Ambos endpoints requieren cookie JWT válida, cuenta activa y `UserRole.ADMIN`.
La población medida incluye únicamente `UserRole.USER`, independientemente del
estado ACTIVE/INACTIVE de la cuenta.

## Contratos

`GET /analytics/summary`

```json
{ "totalUsers": 7, "premiumUsers": 2, "freeUsers": 5 }
```

Premium cuenta usuarios distintos con al menos una suscripción cuyo estado en
la base de datos sea `SubscriptionStatus.ACTIVE`. No evalúa vigencia ni utiliza
`hasPremiumAccess()`. FREE es la diferencia entre total y Premium.

Los dos conteos se ejecutan con el mismo EntityManager en una transacción
`REPEATABLE READ`, para compartir una vista consistente de los datos InnoDB.
Analytics coordina la transacción; cada servicio dueño ejecuta su consulta.

`GET /analytics/registrations?period=day|week|month`

```json
[{ "period": "2026-09-21", "users": 4 }]
```

`period` es obligatorio; valores inválidos y propiedades adicionales reciben 400.
Cada elemento identifica el inicio del período en formato `YYYY-MM-DD`: el día,
el lunes de la semana o el primer día del mes. Se ordena cronológicamente ASC.
Se devuelven únicamente períodos con registros; una población vacía devuelve `[]`.
Los conteos JSON son números.

La agrupación usa `users.created_at` (`DATETIME(3)`) tal como está almacenado,
sin conversiones a la zona local de Node. TypeORM está configurado con
`timezone: 'Z'`; esa opción no cambia la zona de la sesión de MySQL ni corrige
datos históricos. La coherencia UTC de los valores almacenados depende de la
configuración existente de escritura y del servidor.

## Verificación

Las pruebas HTTP usan JwtAuthGuard, JwtStrategy y RolesGuard reales, sustituyendo
las consultas por dobles. Las agregaciones se prueban por separado contra MySQL,
con QueryBuilder real y tablas temporales de nombres aleatorios en una conexión
dedicada. No se modifican tablas persistentes ni se ejecutan migraciones.

Para ejecutar también las pruebas MySQL (PowerShell), usando `DATABASE_*` del
entorno o `.env` y una cuenta con permiso `CREATE TEMPORARY TABLES`:

```powershell
$env:ANALYTICS_MYSQL_TESTS = '1'
npm run test -- src/analytics
```

Sin esa variable se omiten explícitamente las pruebas MySQL. La prueba con tablas
temporales verifica las agregaciones, pero no simula escrituras concurrentes
desde otra conexión ni sustituye una prueba del esquema de despliegue.
