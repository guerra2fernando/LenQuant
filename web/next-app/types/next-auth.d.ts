import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
      is_admin: boolean;
    };
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
  }
}

