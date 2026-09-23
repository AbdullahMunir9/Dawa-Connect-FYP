import mongoose from "mongoose";

let cached = globalThis.mongoose;

if (!cached) {
  cached = globalThis.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is not configured. Add it to the deployment environment before using database features."
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(mongoUri, opts).then((mongoose) => {
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
