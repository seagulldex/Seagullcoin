// generateKeys.js
import crypto from 'crypto';
import fs from 'fs';

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Print to console
console.log('✅ Dummy Private Key PEM:\n', privateKey);
console.log('\n✅ Dummy Public Key PEM:\n', publicKey);

// Optionally save to disk
fs.writeFileSync('./private.pem', privateKey);
fs.writeFileSync('./public.pem', publicKey);
console.log('\n✅ Keys saved to private.pem and public.pem');
