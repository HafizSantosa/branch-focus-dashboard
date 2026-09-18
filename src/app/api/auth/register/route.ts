import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userDb } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { username?: string; email?: string; password?: string };
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }

    if (userDb.findByUsername(username)) {
      return NextResponse.json({ error: "Username sudah digunakan." }, { status: 409 });
    }
    if (userDb.findByEmail(email)) {
      return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const verificationToken = crypto.randomUUID();
    const verificationExpires = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24h

    userDb.create({
      id,
      username,
      email,
      password: passwordHash,
      role: "viewer",
      verification_token: verificationToken,
      verification_expires: verificationExpires,
    });

    await sendVerificationEmail(email, username, verificationToken);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
