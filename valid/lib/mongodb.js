import 'dotenv/config';
import mongoose from 'mongoose';

const globalConnection = globalThis;

export class MongoConnectionError extends Error {
  constructor(cause) {
    super('MongoDB connection failed.', { cause });
    this.name = 'MongoConnectionError';
    this.statusCode = 503;
  }
}

function trackConnection(promise) {
  let trackedPromise;
  trackedPromise = promise.catch((error) => {
    if (globalConnection.mongoConnectionPromise === trackedPromise) {
      globalConnection.mongoConnectionPromise = null;
    }
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorCode = typeof error?.code === 'string' || typeof error?.code === 'number'
      ? `, code ${error.code}`
      : '';
    console.error(`MongoDB connection failed (${errorName}${errorCode}).`);
    throw new MongoConnectionError(error);
  });
  globalConnection.mongoConnectionPromise = trackedPromise;
  return trackedPromise;
}

export default async function dbConnect() {
  const uri = process.env.MONGODB_URI?.trim() || process.env.MONGO_URI?.trim();
  if (mongoose.connection.readyState === 1) return true;

  if (mongoose.connection.readyState === 2) {
    if (!globalConnection.mongoConnectionPromise) {
      trackConnection(mongoose.connection.asPromise());
    }
    await globalConnection.mongoConnectionPromise;
    return true;
  }

  if (!uri) return false;

  globalConnection.mongoConnectionPromise = null;
  if (!globalConnection.mongoConnectionPromise) {
    trackConnection(mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    }));
  }

  await globalConnection.mongoConnectionPromise;
  return true;
}
