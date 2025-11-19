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
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/* (Next.js internals)
     * - /favicon.ico, /robots.txt, etc. (static files)
     */
    "/((?!login|api/auth|_next|favicon.ico|robots.txt).*)",
  ],
};

