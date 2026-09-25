import "next-auth";
import "next-auth/jwt";

import type { UserRole } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      authenticated: boolean;
      sessionVersion: number;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    authenticated?: boolean;
    sessionVersion?: number;
  }
}
