import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// Format: scrypt$<salt base64>$<hash base64>  (N=16384, r=8, p=1, 64 Byte)
export function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${scryptSync(pw, salt, 64).toString('base64')}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(pw, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}
