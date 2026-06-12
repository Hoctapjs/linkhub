import { fetchMetadata } from '@/lib/metadata';
import { getCurrentUserId } from '@/lib/session';

// GET /api/metadata?url=... - Fetch metadata from URL
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return Response.json(
        { error: 'Missing required query parameter: url' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return Response.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const metadata = await fetchMetadata(url);

    return Response.json({
      data: metadata,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Failed to fetch metadata: ${message}` },
      { status: 500 }
    );
  }
}
