import { createHash, randomBytes } from "node:crypto";
import { after, NextResponse } from "next/server";
import { rateLimitDb, userDb } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { normalizeEmail, validateEmail } from "@/lib/user-input";

const SUCCESS_MESSAGE = "Jika email terdaftar dan aktif, tautan reset akan dikirim.";

function json(body: object, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expected = new URL(process.env.NEXTAUTH_URL ?? request.url).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

async function deliverPasswordReset(
  userId: string,
  email: string,
  username: string,
  token: string,
  tokenHash: string
): Promise<void> {
  try {
    await sendPasswordResetEmail(email, username, token);
  } catch {
    try {
      userDb.clearPasswordReset(userId, tokenHash);
    } catch {
      // Keep delivery failures generic when clearing the token also fails.
    }
    console.error("[auth] password reset email delivery failed");
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
  const emailValue = "email" in body ? body.email : undefined;
  if (typeof emailValue !== "string") {
    return json({ error: "Format email tidak valid." }, 400);
  }
  const email = normalizeEmail(emailValue);
  const emailError = validateEmail(email);
  if (emailError) return json({ error: emailError }, 400);

  try {
    const emailLimit = rateLimitDb.consume("forgot-password-email", email, 3, 60 * 60);
    if (!emailLimit.allowed) {
      return json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti." },
        429,
        { "Retry-After": String(emailLimit.retryAfterSeconds) }
      );
    }

    if (process.env.TRUST_PROXY === "true") {
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      if (clientIp) {
        const ipLimit = rateLimitDb.consume("forgot-password-ip", clientIp, 10, 15 * 60);
        if (!ipLimit.allowed) {
          return json(
            { error: "Terlalu banyak permintaan. Coba lagi nanti." },
            429,
            { "Retry-After": String(ipLimit.retryAfterSeconds) }
          );
        }
      }
    }

    const user = userDb.findByEmail(email);
    if (user?.active && user.email_verified) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expires = Math.floor(Date.now() / 1000) + 60 * 60;
      if (userDb.issuePasswordReset(user.id, tokenHash, expires)) {
        // Keep SMTP latency outside the generic response to avoid timing-based enumeration.
        after(() =>
          deliverPasswordReset(user.id, user.email, user.username, token, tokenHash)
        );
      }
    }
    return json({ ok: true, message: SUCCESS_MESSAGE });
  } catch {
    return json({ error: "Terjadi kesalahan." }, 500);
  }
}
