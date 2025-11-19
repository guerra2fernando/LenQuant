import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      // This is called after Google authentication
      // We'll send the Google token to our backend

      if (!account || !account.id_token) {
        return false;
      }

      try {
        // Call our backend to verify and get JWT
        // NextAuth runs on server-side, so we need full URL for fetch
        const apiUrl = process.env.NODE_ENV === 'production'
          ? 'http://api:8000'  // Docker internal network
          : 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/v1/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: account.id_token,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Backend authentication failed:', error);
          return false;
        }

        const data = await response.json();

        // Store our JWT token in the user object
        user.accessToken = data.access_token;
        user.backendUser = data.user;

        return true;
      } catch (error) {
        console.error('Authentication error:', error);
        return false;
      }
    },

    async jwt({ token, user, account }) {
      // Preserve the backend JWT token - don't let NextAuth override it
      if (user && user.accessToken) {
        token.accessToken = user.accessToken;
        token.backendUser = user.backendUser;
        token.accessTokenExpires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
        token.error = undefined; // Clear any previous errors
        return token;
      }

      // Check if access token is expired or close to expiring (within 5 minutes)
      const expirationThreshold = 5 * 60 * 1000; // 5 minutes
      if (token.accessTokenExpires && Date.now() > (Number(token.accessTokenExpires) - expirationThreshold)) {
        console.log('Access token expired or close to expiring, refreshing...');

        try {
          // Try to refresh the token
          const apiUrl = process.env.NODE_ENV === 'production'
            ? 'http://api:8000'  // Docker internal network
            : 'http://localhost:8000';
          const response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Token refreshed successfully');
            token.accessToken = data.access_token;
            token.accessTokenExpires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
            token.error = undefined; // Clear any errors
            return token;
          } else {
            console.log('Token refresh failed, marking token as invalid');
            // Mark token as invalid but still return JWT object
            token.accessToken = undefined;
            token.error = 'RefreshFailed';
            return token;
          }
        } catch (error) {
          console.error('Token refresh error:', error);
          // Mark token as invalid but still return JWT object
          token.accessToken = undefined;
          token.error = 'RefreshError';
          return token;
        }
      }

      return token;
    },

    async session({ session, token }) {
      // If token is invalid (no accessToken or has error), invalidate session
      if (!token || !token.accessToken || token.error) {
        // Return session with expired date to invalidate it
        return {
          ...session,
          expires: new Date(Date.now() - 1000).toISOString(), // Already expired
          user: session.user, // Keep user for cleanup but mark as invalid
        };
      }

      // Send properties to the client - use backend JWT, not NextAuth JWT
      session.accessToken = token.accessToken as string;
      session.user = token.backendUser as any;
      session.expires = new Date(token.accessTokenExpires as number).toISOString();
      return session;
    },
  },
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours - longer than JWT for better UX
  },
  
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);

