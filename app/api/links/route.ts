import { getDb } from '@/lib/mongodb';
import { createLinkSchema, listLinksQuerySchema } from '@/lib/validation';
import { fetchMetadata } from '@/lib/metadata';
import type { MetadataResult } from '@/lib/types';
import { ZodError } from 'zod';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/links - List all links with filtering, searching, and sorting
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = listLinksQuerySchema.parse({
      q: searchParams.get('q') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      tag: searchParams.get('tag') ?? undefined,
    });

    const db = await getDb();
    const linksCollection = db.collection('links');

    // Build filter
    const filter: Record<string, unknown>[] = [];

    // Search in title, url, description using regex
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i');
      filter.push({
        $or: [
          { title: regex },
          { url: regex },
          { description: regex },
        ],
      });
    }

    // Filter by category
    if (query.category) {
      filter.push({ category: { $regex: `^${escapeRegex(query.category)}$`, $options: 'i' } });
    }

    // Filter by tag
    if (query.tag) {
      filter.push({ tags: { $regex: `^${escapeRegex(query.tag)}$`, $options: 'i' } });
    }

    const mongoFilter = filter.length > 0 ? { $and: filter } : {};

    // Fetch links, sort by createdAt descending
    const links = await linksCollection
      .find(mongoFilter)
      .sort({ createdAt: -1 })
      .toArray();

    // Convert ObjectId to string
    const data = links.map((link) => ({
      ...link,
      _id: link._id.toString(),
    }));

    return Response.json({ data });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Failed to fetch links: ${message}` },
      { status: 500 }
    );
  }
}

// POST /api/links - Create a new link
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createLinkSchema.parse(body);

    // Fetch metadata if description or favicon is missing
    const needsMetadata = !validatedData.description || !validatedData.favicon;
    const metadata: Partial<MetadataResult> = needsMetadata ? await fetchMetadata(validatedData.url) : {};

    const now = new Date().toISOString();
    const newLink = {
      title: validatedData.title,
      url: validatedData.url,
      description: validatedData.description || metadata.description,
      favicon: validatedData.favicon || metadata.favicon,
      category: validatedData.category,
      tags: validatedData.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const linksCollection = db.collection('links');
    const result = await linksCollection.insertOne(newLink);

    // Return with _id as string
    const data = {
      ...newLink,
      _id: result.insertedId.toString(),
    };

    return Response.json({ data }, { status: 201 });
  } catch (error: unknown) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return Response.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Failed to create link: ${message}` },
      { status: 500 }
    );
  }
}
