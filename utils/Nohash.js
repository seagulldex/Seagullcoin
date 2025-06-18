import crypto from 'crypto';

export function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}
