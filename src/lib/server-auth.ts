import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";
import { userDb, type DbUser, type UserRole } from "@/lib/db";

export async function getCurrentUser(
  session?: Session | null
): Promise<DbUser | null> {
  const activeSession =
    session !== undefined ? session : await getServerSession(authOptions);
  const id = activeSession?.user?.id;
  if (!id || !activeSession.user.authenticated) return null;

  const user = userDb.findById(id);
  if (
    !user?.active ||
    !user.email_verified ||
    (activeSession?.user.sessionVersion ?? 0) !== user.session_version
  ) return null;
  return user;
}


export async function authorizeApi(
  requiredRole?: UserRole,
  session?: Session | null
) {
  const user = await getCurrentUser(session);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Tidak terautentikasi." },
        { status: 401 }
      ),
    };
  }
  if (requiredRole && user.role !== requiredRole) {
    return {
      user: null,
      response: NextResponse.json({ error: "Akses ditolak." }, { status: 403 }),
    };
  }
  return { user, response: null };
}
