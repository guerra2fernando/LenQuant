import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public marketing pages that don't require authentication
const PUBLIC_PATHS = [
  "/",
  "/extension",
  "/platform",
  "/privacy",
  "/terms",
  "/login",
  "/demo",
];

// Check if a path is public (marketing/landing pages)
function isPublicPath(pathname: string): boolean {
  // Exact matches
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }
  // Paths that start with /demo/
  if (pathname.startsWith("/demo/")) {
    return true;
  }
  return false;
}

export default withAuth(
  function middleware(req) {
    // Allow public paths without authentication
    if (isPublicPath(req.nextUrl.pathname)) {
      return NextResponse.next();
    }
    return null; // Continue to next middleware for protected routes
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow public paths even without token
        if (isPublicPath(req.nextUrl.pathname)) {
          return true;
        }
        // Require token for protected routes
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/* (Next.js internals)
     * - /images/* (static images)
     * - /videos/* (static videos)
     * - Static files (favicon.ico, robots.txt, sitemap.xml, etc.)
     */
    "/((?!api/auth|_next|images|videos|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

