// test-hash.js
import { hashSeed } from './utils/hash.js';

const testSeed = 'example-seed-value';
const hashed = hashSeed(testSeed);

console.log('Seed:', testSeed);
console.log('Hashed:', hashed);
