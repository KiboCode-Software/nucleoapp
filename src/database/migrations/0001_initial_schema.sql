-- Daily Dev Log — Migración 0001: esquema inicial
-- Fechas: TEXT en ISO 8601 (UTC para marcas de tiempo, YYYY-MM-DD para días).
-- Las claves foráneas están activas por defecto en la conexión (sqlx las habilita).

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
  description TEXT    NOT NULL DEFAULT '',
  color       TEXT    CHECK (color IS NULL OR color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Check-in diario: las cuatro preguntas del módulo Daily Log.
CREATE TABLE daily_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  log_date      TEXT    NOT NULL CHECK (log_date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  yesterday     TEXT    NOT NULL DEFAULT '',
  today         TEXT    NOT NULL DEFAULT '',
  blockers_note TEXT    NOT NULL DEFAULT '',
  learnings     TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_daily_logs_log_date   ON daily_logs (log_date DESC);
CREATE INDEX idx_daily_logs_project_id ON daily_logs (project_id);

CREATE TABLE blockers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER REFERENCES daily_logs (id) ON DELETE SET NULL,
  project_id   INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  title        TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  description  TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'escalated')),
  opened_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at  TEXT,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Solo un bloqueo resuelto tiene fecha de resolución, y siempre la tiene.
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);

CREATE INDEX idx_blockers_status     ON blockers (status);
CREATE INDEX idx_blockers_project_id ON blockers (project_id);

-- Intentos de solución registrados para un bloqueo.
CREATE TABLE blocker_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  blocker_id  INTEGER NOT NULL REFERENCES blockers (id) ON DELETE CASCADE,
  description TEXT    NOT NULL CHECK (length(trim(description)) > 0),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_blocker_attempts_blocker_id ON blocker_attempts (blocker_id);

CREATE TABLE learnings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_log_id INTEGER REFERENCES daily_logs (id) ON DELETE SET NULL,
  project_id   INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  kind         TEXT    NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'concept', 'error_fix', 'command')),
  title        TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  content      TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_learnings_project_id ON learnings (project_id);
CREATE INDEX idx_learnings_kind       ON learnings (kind);

-- Etiquetas y tecnologías para clasificar aprendizajes.
CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0)
);

CREATE TABLE learning_tags (
  learning_id INTEGER NOT NULL REFERENCES learnings (id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (learning_id, tag_id)
) WITHOUT ROWID;

CREATE TABLE reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  period       TEXT    NOT NULL CHECK (period IN ('daily', 'weekly')),
  period_start TEXT    NOT NULL,
  period_end   TEXT    NOT NULL,
  content      TEXT    NOT NULL,
  generator    TEXT    NOT NULL DEFAULT 'template' CHECK (generator IN ('template', 'local_ai')),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (period_end >= period_start)
);

CREATE INDEX idx_reports_period_start ON reports (period_start DESC);

-- Relación N:M — qué registros diarios resume cada reporte.
CREATE TABLE report_daily_logs (
  report_id    INTEGER NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  daily_log_id INTEGER NOT NULL REFERENCES daily_logs (id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, daily_log_id)
) WITHOUT ROWID;

-- Preferencias clave/valor (valores serializados como JSON).
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL CHECK (json_valid(value)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) WITHOUT ROWID;

CREATE TABLE backups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path  TEXT    NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO settings (key, value) VALUES
  ('theme', '"light"'),
  ('language', '"es"'),
  ('telemetry', 'false');
