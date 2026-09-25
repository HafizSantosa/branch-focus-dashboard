import bcrypt from "bcryptjs";
import type { NextAuthOptions, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { rateLimitDb, userDb, type UserRole } from "@/lib/db";

interface AppUserToken extends User {
  role: UserRole;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request): Promise<AppUserToken | null> {
        if (!credentials?.username || !credentials?.password) return null;

        const username = credentials.username.trim().toLowerCase();
        if (process.env.TRUST_PROXY === "true") {
          const forwardedHeader = request.headers?.["x-forwarded-for"];
          const forwardedFor = Array.isArray(forwardedHeader)
            ? forwardedHeader[0]
            : String(forwardedHeader ?? "");
          const clientIp = forwardedFor.split(",")[0]?.trim();
          if (clientIp) {
            const loginLimit = rateLimitDb.consume(
              "login",
              `${username}:${clientIp}`,
              10,
              15 * 60
            );
            if (!loginLimit.allowed) throw new Error("RATE_LIMITED");
          }
        }

        const user = userDb.findByUsername(username);
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        if (!user.email_verified) throw new Error("EMAIL_NOT_VERIFIED");
        if (!user.active) throw new Error("ACCOUNT_DISABLED");

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        const appUser = user as AppUserToken;
        token.sub = appUser.id;
        token.role = appUser.role;
      }

      if (!token.sub) {
        token.authenticated = false;
        return token;
      }

      const currentUser = userDb.findById(token.sub);
      const authenticated = Boolean(
        currentUser?.active && currentUser.email_verified
      );
      token.authenticated = authenticated;
      if (authenticated && currentUser) {
        token.name = currentUser.username;
        token.email = currentUser.email;
        token.role = currentUser.role;
      } else {
        delete token.role;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role === "admin" ? "admin" : "viewer";
        session.user.authenticated = token.authenticated === true;
      }
      return session;
    },
  },

  pages: { signIn: "/login" },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
