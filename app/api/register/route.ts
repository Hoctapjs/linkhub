import { getDb, ensureIndexes } from "@/lib/mongodb";
import { registerSchema } from "@/lib/validation";
import type { PublicUser } from "@/lib/types";
import { hash } from "bcryptjs";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    const email = validated.email.toLowerCase().trim();

    await ensureIndexes();
    const db = await getDb();
    const usersCollection = db.collection("users");

    const existing = await usersCollection.findOne({ email });
    if (existing) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(validated.password, 10);
    const now = new Date().toISOString();

    const result = await usersCollection.insertOne({
      email,
      name: validated.name,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    const publicUser: PublicUser = {
      _id: result.insertedId.toString(),
      email,
      name: validated.name,
      createdAt: now,
    };

    return Response.json({ data: publicUser }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    // MongoDB duplicate key error (race condition fallback)
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "11000"
    ) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: `Registration failed: ${message}` },
      { status: 500 }
    );
  }
}
