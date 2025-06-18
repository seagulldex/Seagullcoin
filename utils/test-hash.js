import crypto from 'crypto';

export function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

// Test example
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSeed = "example";
  console.log("Seed:", testSeed);
  console.log("Hashed:", hashSeed(testSeed));
}
