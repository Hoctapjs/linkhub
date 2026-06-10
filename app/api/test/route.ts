/**
 * Test route for verifying MongoDB connection
 * This is a temporary test route and should be removed after Phase 1 verification
 * GET /api/test
 */

import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();

    // Try to ping the database
    const adminDb = db.admin();
    const pingResult = await adminDb.ping();

    // List collections in the database
    const collections = await db.listCollections().toArray();

    return Response.json({
      status: "success",
      message: "MongoDB connection successful",
      ping: pingResult,
      database: "linkhub",
      collectionsCount: collections.length,
      collections: collections.map((c) => c.name),
    });
  } catch (error) {
    console.error("Test route error:", error);

    return Response.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
