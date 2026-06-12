import { getDb } from "@/lib/mongodb";

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

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
