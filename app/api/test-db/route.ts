import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const collections = await db.listCollections().toArray();
    return Response.json({
      success: true,
      message: 'Connected to MongoDB successfully',
      database: db.databaseName,
      collectionsCount: collections.length,
      collections: collections.map((c) => c.name),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        success: false,
        error: 'Failed to connect to MongoDB',
        details: message,
      },
      { status: 500 }
    );
  }
}
