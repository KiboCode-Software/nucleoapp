# Base de datos

SQLite local gestionada por [`tauri-plugin-sql`](https://v2.tauri.app/plugin/sql/). El archivo se crea en el directorio de datos de la app la primera vez que se abre.

## Migraciones

- Viven en `src/database/migrations/NNNN_descripcion.sql`.
- Se registran en `src-tauri/src/lib.rs` con `include_str!`, así que Rust y las pruebas usan exactamente el mismo SQL.
- Nunca se edita una migración ya publicada: los cambios van en una nueva con el siguiente número de versión.
- `tests/migrations.test.ts` aplica el esquema sobre SQLite en memoria (`node:sqlite`) y comprueba las restricciones.

## Tablas

| Tabla | Propósito | Notas |
| --- | --- | --- |
| `projects` | Proyectos | `name` único sin distinguir mayúsculas; `archived` 0/1; `color` hex opcional |
| `daily_logs` | Check-in diario | Cuatro preguntas: `yesterday`, `today`, `blockers_note`, `learnings`; `log_date` `YYYY-MM-DD` |
| `blockers` | Problemas técnicos | `status`: `pending` · `resolved` · `escalated`; `resolved_at` obligatorio solo si está resuelto |
| `blocker_attempts` | Intentos de solución | Se borran con su bloqueo (`ON DELETE CASCADE`) |
| `learnings` | Aprendizajes | `kind`: `note` · `concept` · `error_fix` · `command` |
| `tags`, `learning_tags` | Etiquetas y tecnologías | Relación N:M |
| `reports` | Reportes generados | `period`: `daily` · `weekly`; `generator`: `template` · `local_ai` |
| `report_daily_logs` | Registros resumidos en cada reporte | Relación N:M |
| `settings` | Preferencias clave/valor | `value` en JSON válido; valores iniciales: `theme`, `language`, `telemetry` |
| `backups` | Historial de respaldos | Ruta y tamaño del archivo |
| `captures` | Bandeja de captura rápida (migración 0002) | `processed_as`: `blocker` · `learning` · `daily_log` · `discarded`; NULL mientras está pendiente |

## Respaldos

- Se crean con `VACUUM INTO`, que produce una copia consistente aunque la base esté abierta.
- Por defecto van a la carpeta local de respaldos de Núcleo con nombre `nucleo-AAAA-MM-DD-HHMMSS.db`; la carpeta se puede cambiar en Ajustes. Los respaldos anteriores con el prefijo `daily-dev-log-` también se reconocen.
- Automáticos una vez al día mientras la app está abierta; se conservan los N más recientes (10 por defecto). Rust solo lista y borra archivos de respaldo reconocidos.
- Para restaurar uno: cierra la app y reemplaza la base de datos del perfil por la copia. El archivo principal conserva el nombre técnico heredado para no perder datos de instalaciones existentes.

## Integridad

- Claves foráneas activas (sqlx las habilita en cada conexión).
- Borrar un proyecto o un registro diario **desvincula** (`SET NULL`) sus bloqueos y aprendizajes en lugar de borrarlos.
- Índices sobre fechas, estados y claves foráneas de consulta frecuente.
- Los esquemas Zod de `src/types/entities.ts` replican las mismas reglas para validar antes de escribir.
