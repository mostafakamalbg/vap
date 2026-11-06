import 'dotenv/config';
import mongoose from 'mongoose';

const globalConnection = globalThis;

export class MongoConnectionError extends Error {
  constructor() {
    super('MongoDB connection failed.');
    this.name = 'MongoConnectionError';
  }
}

export default async function dbConnect() {
  const uri = process.env.MONGODB_URI?.trim() || process.env.MONGO_URI?.trim();
  if (!uri) return false;
  if (mongoose.connection.readyState === 1) return true;

  if (mongoose.connection.readyState !== 2 || !globalConnection.mongoConnectionPromise) {
    globalConnection.mongoConnectionPromise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    }).catch((error) => {
      globalConnection.mongoConnectionPromise = null;
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      console.error(`MongoDB connection failed (${errorName}).`);
      throw new MongoConnectionError();
    });
  }

  await globalConnection.mongoConnectionPromise;
  return true;
}
