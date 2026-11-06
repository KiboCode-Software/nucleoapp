-- Sesiones de enfoque (Pomodoro) y tarjetas de repaso espaciado.

-- Una fila por bloque de enfoque terminado (o interrumpido tras al menos un minuto).
CREATE TABLE focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  -- Minutos de enfoque efectivos.
  minutes INTEGER NOT NULL CHECK (minutes > 0),
  completed INTEGER NOT NULL DEFAULT 1 CHECK (completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_focus_sessions_started_at ON focus_sessions (started_at);

-- Tarjetas pregunta/respuesta asociadas a un aprendizaje (apunte), con repaso SM-2.
CREATE TABLE review_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learning_id INTEGER NOT NULL REFERENCES learnings (id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (length(trim(question)) > 0),
  answer TEXT NOT NULL CHECK (length(trim(answer)) > 0),
  ease REAL NOT NULL DEFAULT 2.5 CHECK (ease >= 1.3),
  interval_days INTEGER NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  -- Día local (YYYY-MM-DD) en que toca repasarla.
  due_on TEXT NOT NULL CHECK (due_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_review_cards_due_on ON review_cards (due_on);
CREATE INDEX idx_review_cards_learning_id ON review_cards (learning_id);
