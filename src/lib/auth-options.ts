import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { NextAuthOptions, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { userDb } from "@/lib/db";

interface AppUserToken extends User {
  role: "admin" | "viewer";
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AppUserToken | null> {
        if (!credentials?.username || !credentials?.password) return null;

        const user = userDb.findByUsername(credentials.username);
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        if (!user.email_verified) throw new Error("EMAIL_NOT_VERIFIED");
        if (!user.active) throw new Error("ACCOUNT_DISABLED");

        return { id: user.id, name: user.username, role: user.role };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        const appUser = user as AppUserToken;
        token.role = appUser.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role as "admin" | "viewer";
      }
      return session;
    },
  },

  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
