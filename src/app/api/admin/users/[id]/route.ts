import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { userDb } from "@/lib/db";

async function adminGuard(session: Session | null, targetId: string) {
  if (!session?.user) return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const self = userDb.findByUsername(session.user.name!);
  if (self?.id === targetId) return NextResponse.json({ error: "Tidak dapat mengubah akun sendiri di sini." }, { status: 400 });
  return null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = await adminGuard(session, params.id);
  if (guard) return guard;

  const body = await req.json() as { role?: string; active?: boolean };

  if (body.role !== undefined) {
    if (!["admin", "viewer"].includes(body.role))
      return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
    userDb.updateRole(params.id, body.role);
  }
  if (body.active !== undefined) {
    userDb.updateActive(params.id, body.active ? 1 : 0);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const guard = await adminGuard(session, params.id);
  if (guard) return guard;

  if (!userDb.findById(params.id))
    return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  userDb.delete(params.id);
  return NextResponse.json({ ok: true });
}
