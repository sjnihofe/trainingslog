// Erzeugt ein Session-Token für lokale Tests (braucht SESSION_SECRET, optional TL_UID). Nur für localhost-Tests verwenden.
import { createHmac } from 'crypto';
const b64 = (b) => Buffer.from(b).toString('base64url');
const payload = b64(JSON.stringify({ uid: Number(process.env.TL_UID ?? 1), exp: Date.now() + 3600_000 }));
const sig = createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
process.stdout.write(`${payload}.${sig}`);
