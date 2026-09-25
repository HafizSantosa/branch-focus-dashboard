import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { userDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { validatePassword } from "@/lib/user-input";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Tidak terautentikasi." },
      { status: 401 }
    );
  }

  const body = (await req.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json(
      { error: "Semua field wajib diisi." },
      { status: 400 }
    );
  }

  const passwordError = validatePassword(body.newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const currentPasswordValid = await bcrypt.compare(
    body.currentPassword,
    user.password
  );
  if (!currentPasswordValid) {
    return NextResponse.json(
      { error: "Password saat ini salah." },
      { status: 400 }
    );
  }
  if (await bcrypt.compare(body.newPassword, user.password)) {
    return NextResponse.json(
      { error: "Password baru harus berbeda dari password saat ini." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(body.newPassword, 12);
  userDb.updatePassword(user.id, passwordHash);
  return NextResponse.json({ ok: true });
}
