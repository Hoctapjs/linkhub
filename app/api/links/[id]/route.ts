import { getDb } from '@/lib/mongodb';
import { fetchMetadata } from '@/lib/metadata';
import { updateLinkSchema } from '@/lib/validation';
import { ObjectId } from 'mongodb';
import { ZodError } from 'zod';

function normalizeTags(tags: string[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

// GET /api/links/[id] - Get a single link
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return Response.json({ error: 'Invalid link ID' }, { status: 400 });
    }

    const db = await getDb();
    const linksCollection = db.collection('links');
    const link = await linksCollection.findOne({ _id: new ObjectId(id) });

    if (!link) {
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    // Convert ObjectId to string
    const data = {
      ...link,
      _id: link._id.toString(),
    };

    return Response.json({ data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Failed to fetch link: ${message}` },
      { status: 500 }
    );
  }
}

// PUT /api/links/[id] - Update a link
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return Response.json({ error: 'Invalid link ID' }, { status: 400 });
    }

    const body = await request.json();

    // Validate input
    const validatedData = updateLinkSchema.parse(body);

    const db = await getDb();
    const linksCollection = db.collection('links');
    const objectId = new ObjectId(id);
    const existing = await linksCollection.findOne({ _id: objectId });

    if (!existing) {
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now };
    const unsetData: Record<string, ''> = {};

    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }

    if (validatedData.url !== undefined) {
      updateData.url = validatedData.url;
    }

    if (validatedData.tags !== undefined) {
      updateData.tags = normalizeTags(validatedData.tags);
    }

    if (validatedData.description === null) {
      unsetData.description = '';
    } else if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }

    if (validatedData.category === null) {
      unsetData.category = '';
    } else if (validatedData.category !== undefined) {
      updateData.category = validatedData.category;
    }

    if (validatedData.favicon !== undefined) {
      updateData.favicon = validatedData.favicon;
    }

    const nextUrl = validatedData.url ?? existing.url;
    const urlChanged = validatedData.url !== undefined && validatedData.url !== existing.url;
    const shouldFetchMetadata = urlChanged;

    if (shouldFetchMetadata) {
      const metadata = await fetchMetadata(nextUrl);

      if (validatedData.description === undefined && metadata.description) {
        updateData.description = metadata.description;
      }

      if (validatedData.favicon === undefined && metadata.favicon) {
        updateData.favicon = metadata.favicon;
      }
    }

    const updateResult = await linksCollection.findOneAndUpdate(
      { _id: objectId },
      {
        $set: updateData,
        ...(Object.keys(unsetData).length > 0 ? { $unset: unsetData } : {}),
      },
      { returnDocument: 'after' }
    );

    if (!updateResult || !updateResult.value) {
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    // Convert ObjectId to string
    const data = {
      ...updateResult.value,
      _id: updateResult.value._id.toString(),
    };

    return Response.json({ data });
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
      { error: `Failed to update link: ${message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/links/[id] - Delete a link
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return Response.json({ error: 'Invalid link ID' }, { status: 400 });
    }

    const db = await getDb();
    const linksCollection = db.collection('links');
    const result = await linksCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return Response.json({ error: 'Link not found' }, { status: 404 });
    }

    return Response.json({
      data: { deletedId: id },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Failed to delete link: ${message}` },
      { status: 500 }
    );
  }
}
