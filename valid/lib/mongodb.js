import 'dotenv/config';
import mongoose from 'mongoose';

const globalConnection = globalThis;

export default async function dbConnect() {
  const uri = process.env.MONGO_URI;
  if (!uri) return false;
  if (mongoose.connection.readyState === 1) return true;

  if (mongoose.connection.readyState !== 2 || !globalConnection.mongoConnectionPromise) {
    globalConnection.mongoConnectionPromise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    }).catch((error) => {
      globalConnection.mongoConnectionPromise = null;
      throw error;
    });
  }

  await globalConnection.mongoConnectionPromise;
  return true;
}
