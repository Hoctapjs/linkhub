/**
 * MongoDB connection singleton
 * Follows Next.js best practices for caching connections during dev hot-reload
 */

import { MongoClient, Db, Collection } from "mongodb";
import type { User, Link } from "./types";

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
let indexesEnsured = false;

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
 * Create required indexes idempotently. Safe to call multiple times — runs only once per process.
 */
export async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;

  try {
    const db = await getDb();
    await Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("links").createIndex({ ownerId: 1, createdAt: -1 }),
    ]);
  } catch (error) {
    // Reset flag so next request can retry
    indexesEnsured = false;
    throw error;
  }
}

export function getUsersCollection(db: Db): Collection<Omit<User, "_id">> {
  return db.collection<Omit<User, "_id">>("users");
}

export function getLinksCollection(db: Db): Collection<Omit<Link, "_id">> {
  return db.collection<Omit<Link, "_id">>("links");
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
