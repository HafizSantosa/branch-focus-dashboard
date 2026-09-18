import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { userDb } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const body = await req.json() as { currentPassword?: string; newPassword?: string };
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password baru minimal 8 karakter." }, { status: 400 });
  }

  const user = userDb.findByUsername(session.user.name);
  if (!user) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Password saat ini salah." }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  userDb.updatePassword(user.id, hash);
  return NextResponse.json({ ok: true });
}
