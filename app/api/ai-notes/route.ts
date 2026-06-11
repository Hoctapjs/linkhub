import { generateLinkData } from '@/lib/ai';
import { z, ZodError } from 'zod';

const bodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'URL is required')
    .refine((v) => {
      try {
        const p = new URL(v);
        return p.protocol === 'http:' || p.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'URL must use http:// or https://'),
});

// POST /api/ai-notes — generate AI data for a URL
export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return Response.json(
      { error: 'AI feature is not configured (missing GROQ_API_KEY)' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { url } = bodySchema.parse(body);
    const data = await generateLinkData(url);
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
      { error: `Failed to generate data: ${message}` },
      { status: 500 }
    );
  }
}
