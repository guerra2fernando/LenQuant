import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      is_admin: boolean;
    };
    expires: string;
  }

  interface User {
    accessToken?: string;
    backendUser?: any;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    backendUser?: any;
    accessTokenExpires?: number;
    error?: string;
  }
}

