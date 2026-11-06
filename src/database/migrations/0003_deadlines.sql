-- Daily Dev Log — Migración 0003: entregas y exámenes (modo estudiante)
-- due_at es fecha y hora LOCAL ("YYYY-MM-DDTHH:MM"): una entrega "el viernes a las
-- 23:59" no debe moverse si cambia la zona horaria del equipo.

CREATE TABLE deadlines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  title      TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  kind       TEXT    NOT NULL DEFAULT 'assignment' CHECK (kind IN ('assignment', 'exam', 'presentation', 'other')),
  due_at     TEXT    NOT NULL CHECK (due_at GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]'),
  notes      TEXT    NOT NULL DEFAULT '',
  -- Peso en la nota final (%) y calificación obtenida, ambos opcionales.
  weight     REAL    CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
  grade      REAL,
  done_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_deadlines_due_at     ON deadlines (due_at);
CREATE INDEX idx_deadlines_project_id ON deadlines (project_id);
