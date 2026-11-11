import { createHash, randomBytes } from 'node:crypto';

export function generateToken() {
  return randomBytes(32).toString('base64url');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
