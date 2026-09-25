import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { userDb } from "@/lib/db";
import { validatePassword } from "@/lib/user-input";

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(process.env.NEXTAUTH_URL ?? request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!originAllowed(request)) return json({ error: "Origin tidak diizinkan." }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Permintaan tidak valid." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Permintaan tidak valid." }, 400);
  }
  const token = "token" in body ? body.token : undefined;
  const newPassword = "newPassword" in body ? body.newPassword : undefined;
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    return json({ error: "Tautan reset tidak valid atau sudah kedaluwarsa." }, 400);
  }
  if (typeof newPassword !== "string") {
    return json({ error: "Password baru wajib diisi." }, 400);
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return json({ error: passwordError }, 400);

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (!userDb.hasValidPasswordReset(tokenHash)) {
      return json({ error: "Tautan reset tidak valid atau sudah kedaluwarsa." }, 400);
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    if (!userDb.consumePasswordReset(tokenHash, passwordHash)) {
      return json({ error: "Tautan reset tidak valid atau sudah kedaluwarsa." }, 400);
    }
    return json({ ok: true });
  } catch {
    return json({ error: "Terjadi kesalahan." }, 500);
  }
}
