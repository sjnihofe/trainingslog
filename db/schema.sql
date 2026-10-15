-- Trainingslog Schema (PostgreSQL / Neon) – Mehrbenutzer
CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  email         text NOT NULL,
  password_hash text NOT NULL,              -- scrypt$salt$hash
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));

CREATE TABLE IF NOT EXISTS exercises (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category    text NOT NULL CHECK (category IN ('Beine','Rücken','Brust','Schulter','Sonstiges')),
  archived    boolean NOT NULL DEFAULT false,
  favorite    boolean NOT NULL DEFAULT false,   -- Standardübung
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS exercises_user_name ON exercises (user_id, lower(name));

CREATE TABLE IF NOT EXISTS workouts (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workouts_user_date ON workouts (user_id, date);

CREATE TABLE IF NOT EXISTS entries (
  id          serial PRIMARY KEY,
  workout_id  integer NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id integer NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
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

-- Passkeys (Fingerabdruck / Face ID), pro Konto
CREATE TABLE IF NOT EXISTS passkeys (
  id          text PRIMARY KEY,          -- credential id (base64url)
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key  text NOT NULL,             -- base64url
  counter     bigint NOT NULL DEFAULT 0,
  transports  text,
  device_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used   timestamptz
);

-- Strava (Tokens AES-GCM-verschlüsselt)
CREATE TABLE IF NOT EXISTS strava_auth (
  user_id           integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  athlete_id        bigint NOT NULL,
  athlete_name      text,
  scope             text,
  access_token_enc  text NOT NULL,
  refresh_token_enc text NOT NULL,
  expires_at        bigint NOT NULL,
  last_sync         timestamptz,
  connected_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  strava_id        bigint PRIMARY KEY,
  user_id          integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time       timestamptz NOT NULL,
  start_date       date NOT NULL,
  name             text,
  sport_type       text NOT NULL,
  distance_m       numeric(10,1) NOT NULL,
  moving_time_s    int NOT NULL,
  elapsed_time_s   int,
  elevation_gain_m numeric(7,1),
  avg_hr           numeric(5,1),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_user_date ON runs (user_id, start_date);
