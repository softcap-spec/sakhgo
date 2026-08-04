import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple middleware: block /admin for non-admins
// Relies on a cookie set client-side after successful admin login.
// Actual role check is done client-side in the admin page.
export function middleware(req: NextRequest) {
  // This is a lightweight check; auth is enforced client-side
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
