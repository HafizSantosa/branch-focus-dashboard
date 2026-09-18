import { NextResponse } from "next/server";
import { userDb } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token tidak ditemukan." }, { status: 400 });
  }

  const user = userDb.findByVerificationToken(token);
  if (!user) {
    return NextResponse.json({ error: "Token tidak valid atau sudah digunakan." }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (user.verification_expires && user.verification_expires < now) {
    return NextResponse.json({ error: "Token sudah kadaluarsa. Silakan daftar ulang." }, { status: 400 });
  }

  userDb.verifyEmail(user.id);
  return NextResponse.json({ ok: true });
}
