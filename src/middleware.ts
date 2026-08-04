import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session";

// Blocks /admin for anyone without a valid admin session cookie.
// The cookie is signed server-side (see src/lib/session.ts) so it can't be
// forged by the client — this replaces the old client-only role check.
export async function middleware(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get("session")?.value);
  if (session?.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
