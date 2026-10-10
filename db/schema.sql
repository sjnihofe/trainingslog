-- Trainingslog Schema (PostgreSQL / Neon)
CREATE TABLE IF NOT EXISTS exercises (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  category    text NOT NULL CHECK (category IN ('Beine','Rücken','Brust','Schulter','Sonstiges')),
  archived    boolean NOT NULL DEFAULT false,
  favorite    boolean NOT NULL DEFAULT false,   -- Standardübung
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workouts (
  id          serial PRIMARY KEY,
  date        date NOT NULL UNIQUE,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entries (
  id          serial PRIMARY KEY,
  workout_id  integer NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id integer NOT NULL REFERENCES exercises(id),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entries_workout_idx ON entries(workout_id);
CREATE INDEX IF NOT EXISTS entries_exercise_idx ON entries(exercise_id);

CREATE TABLE IF NOT EXISTS sets (
  id          serial PRIMARY KEY,
  entry_id    integer NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  set_no      integer NOT NULL,
  reps        integer,
  weight      numeric(6,2),
  bodyweight  boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS sets_entry_idx ON sets(entry_id);

-- Auth: Einstellungen (Passwort-Hash) und Passkeys (Face ID / Touch ID)
CREATE TABLE IF NOT EXISTS app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

CREATE TABLE IF NOT EXISTS passkeys (
  id          text PRIMARY KEY,          -- credential id (base64url)
  public_key  text NOT NULL,             -- base64url
  counter     bigint NOT NULL DEFAULT 0,
  transports  text,
  device_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used   timestamptz
);
