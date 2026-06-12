import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/api/register"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isPublic =
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/")) ||
    path.startsWith("/api/auth/");

  const session = await auth();
  const isLoggedIn = !!session?.user;

  // Logged in → redirect away from auth pages
  if (isLoggedIn && (path === "/login" || path === "/register")) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  // Not logged in → API routes return 401 JSON; pages redirect to login
  if (!isLoggedIn && !isPublic) {
    const isApiRoute = path.startsWith("/api/");
    if (isApiRoute) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
