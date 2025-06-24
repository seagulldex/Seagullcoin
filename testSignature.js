import fs from 'fs';
import { signBlock } from './utils/signBlock.js';
import { verifySignature } from './utils/verifySignature.js';

const privateKeyPem = fs.readFileSync('./keys/private.pem', 'utf-8');
const hash = 'test-data-123';

const sig = signBlock(hash, privateKeyPem);
const isValid = verifySignature(hash, sig);

console.log('Signature:', sig);
console.log('✅ Signature valid:', isValid);
