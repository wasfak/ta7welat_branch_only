import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
declare global { var _mongoose: Cache | undefined; }

const cached: Cache = global._mongoose ?? { conn: null, promise: null };
global._mongoose = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise)
    cached.promise = mongoose.connect(MONGODB_URI!, { bufferCommands: false });
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}
