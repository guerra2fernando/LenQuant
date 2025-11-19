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
        // Use environment variable or default to localhost for development
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                      (process.env.NODE_ENV === 'production' ? 'https://lenquant.com' : 'http://localhost:8000');
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
      // Persist the OAuth access_token and backend JWT to the token right after signin
      if (user) {
        token.accessToken = user.accessToken;
        token.backendUser = user.backendUser;
      }
      return token;
    },
    
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string;
      session.user = token.backendUser as any;
      return session;
    },
  },
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 1 hour (match backend JWT expiration)
  },
  
  debug: process.env.NODE_ENV === 'development',
};

export default NextAuth(authOptions);

