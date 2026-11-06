-- Daily Dev Log — Migración 0002: bandeja de captura rápida
-- Ideas anotadas al vuelo (atajo global) que se clasifican después.

CREATE TABLE captures (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  content      TEXT    NOT NULL CHECK (length(trim(content)) > 0),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Cuándo y cómo se clasificó; ambos NULL mientras está pendiente.
  processed_at TEXT,
  processed_as TEXT    CHECK (processed_as IS NULL OR processed_as IN ('blocker', 'learning', 'daily_log', 'discarded')),
  CHECK ((processed_at IS NULL) = (processed_as IS NULL))
);

CREATE INDEX idx_captures_pending ON captures (processed_at, created_at);
