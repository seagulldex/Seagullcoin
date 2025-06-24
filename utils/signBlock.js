// utils/signBlock.js
import crypto from 'crypto';

export function signBlock(data, privateKeyPem) {
  const signer = crypto.createSign('SHA256');
  signer.update(data);
  signer.end();

  const signature = signer.sign(privateKeyPem);
  return signature.toString('base64');
}
