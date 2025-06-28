// db.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI; // ⬅️ uses env var

if (!uri) {
  throw new Error('❌ MONGO_URI environment variable is not defined');
}

const client = new MongoClient(uri);
let db = null;

export async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db(); // default database from URI
  }
  return db;
}
