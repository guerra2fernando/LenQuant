import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login (login page)
     * - /terms, /privacy (public pages)
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/* (Next.js internals)
     * - /images/* (static images)
     * - /favicon.ico, /robots.txt, etc. (static files)
     */
    "/((?!login|terms|privacy|api/auth|_next|images|favicon.ico|robots.txt).*)",
  ],
};

