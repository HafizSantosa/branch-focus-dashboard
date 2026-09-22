import { NextResponse } from "next/server";
import { userDb } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token tidak ditemukan." }, { status: 400 });
  }

  const result = userDb.consumeVerificationToken(token);
  if (result === "expired") {
    return NextResponse.json(
      { error: "Token sudah kadaluarsa. Silakan daftar ulang." },
      { status: 400 }
    );
  }
  if (result === "invalid") {
    return NextResponse.json(
      { error: "Token tidak valid atau sudah digunakan." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
