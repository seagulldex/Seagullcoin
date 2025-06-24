// utils/verifySignature.js
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const publicKeyPem = fs.readFileSync(path.resolve('./keys/public.pem'), 'utf-8');

export function verifySignature(data, signatureBase64) {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(data);
  verifier.end();

  const signatureBuffer = Buffer.from(signatureBase64, 'base64');
  return verifier.verify(publicKeyPem, signatureBuffer);
}
