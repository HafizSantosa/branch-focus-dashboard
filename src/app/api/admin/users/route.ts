import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { userDb } from "@/lib/db";

function adminGuard(session: Session | null) {
  if (!session?.user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const guard = adminGuard(session);
  if (guard) return guard;

  const users = userDb.findAll().map((u) => {
    const { password: _p, verification_token: _t, ...safe } = u;
    void _p; void _t;
    return safe;
  });
  return NextResponse.json(users);
}
