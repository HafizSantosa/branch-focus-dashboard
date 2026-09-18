"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import type { ReactNode } from "react";

/** Wrap the app tree with NextAuth's SessionProvider. */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

export interface AuthContextValue {
  name: string;
  role: "admin" | "viewer";
  isAdmin: boolean;
}

/**
 * Returns the current user's display name, role, and isAdmin flag.
 * Must be used inside a component wrapped by <AuthProvider>.
 * Falls back to viewer while the session is loading.
 */
export function useAuth(): AuthContextValue {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "viewer";
  return {
    name: session?.user?.name ?? "—",
    role,
    isAdmin: role === "admin",
  };
}

/** Sign the user out and redirect to the login page. */
export function logout() {
  signOut({ callbackUrl: "/login" });
}
