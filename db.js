// db.ts
import mongoose from 'mongoose';
import Token from './models/Token.js';  // default import

export async function loadGenesisToken() {
  const token = await Token.findOne({ isGenesisToken: true });
  return token;
}
