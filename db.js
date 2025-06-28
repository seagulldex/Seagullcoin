// db.ts
import mongoose from 'mongoose';
import { Token } from '../models/Token.js'; // your Mongoose schema

export async function loadGenesisToken() {
  const token = await Token.findOne({ isGenesisToken: true });
  return token;
}
