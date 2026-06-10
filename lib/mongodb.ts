/**
 * MongoDB connection singleton
 * Follows Next.js best practices for caching connections during dev hot-reload
 */

import { MongoClient, Db } from "mongodb";

const DB_NAME = "linkhub";

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI environment variable is not set. Please add it to .env.local"
    );
  }
  return uri;
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * Connect to MongoDB and return the database instance
 * Uses caching to avoid multiple connections during hot-reload in development
 */
async function getDb(): Promise<Db> {
  // Return cached db if available
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const mongoUri = getMongoUri();
    const client = new MongoClient(mongoUri);

    // In development, cache the connection globally to avoid reconnecting on hot-reload
    if (process.env.NODE_ENV === "development") {
      // Use global to persist across module reloads
      const globalWithMongo = global as typeof globalThis & {
        mongoClient?: MongoClient;
      };

      if (globalWithMongo.mongoClient) {
        cachedClient = globalWithMongo.mongoClient;
      } else {
        await client.connect();
        globalWithMongo.mongoClient = client;
        cachedClient = client;
      }
    } else {
      // In production, create a new connection each time (serverless context)
      await client.connect();
      cachedClient = client;
    }

    cachedDb = cachedClient.db(DB_NAME);
    return cachedDb;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

/**
 * Close MongoDB connection
 * Useful for cleanup in testing or graceful shutdown
 */
export async function closeDb(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}

export { getDb };
