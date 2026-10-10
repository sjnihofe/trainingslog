# Trainingslog

Persönliche Web-App zum Erfassen von Krafttraining – optimiert fürs Handy (zum Homescreen hinzufügen).

- **Training:** Tag öffnen (Datum änderbar zum Nachtragen), 5 Kategorien (Beine, Rücken, Brust, Schulter, Sonstiges), Übung wählen oder neu anlegen, Sätze mit Wdh + Gewicht erfassen. Werte vom letzten Mal werden vorausgefüllt.
- **Verlauf:** alle Trainings chronologisch.
- **Fortschritt:** Diagramm je Übung (Top-Gewicht, geschätztes 1RM, Volumen bzw. Wdh bei Körpergewicht).
- **Login:** Face ID / Touch ID (Passkeys) oder Passwort.

## Stack
Next.js (App Router) · Neon Postgres · Vercel · SimpleWebAuthn

## Setup
1. `db/schema.sql` in der Datenbank ausführen.
2. Env-Variablen setzen (siehe `.env.example`): `DATABASE_URL`, `SESSION_SECRET`.
3. Passwort-Hash in `app_settings` (`key = 'password_hash'`, Format `scrypt$salt$hash`) anlegen.
