import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { rateLimitDb, userDb } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import {
  normalizeEmail,
  normalizeUsername,
  validateCompany,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/user-input";

const REGISTRATION_WINDOW_SECONDS = 60 * 60;
const PUBLIC_REGISTRATION_ENABLED =
  process.env.ALLOW_PUBLIC_REGISTRATION === "true";

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Terlalu banyak percobaan pendaftaran. Coba lagi nanti." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

export async function GET() {
  return NextResponse.json(
    { enabled: PUBLIC_REGISTRATION_ENABLED },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  if (!PUBLIC_REGISTRATION_ENABLED) {
    return NextResponse.json(
      { error: "Pendaftaran publik dinonaktifkan. Hubungi administrator." },
      { status: 403 }
    );
  }
  try {
    const body = (await req.json()) as {
      username?: string;
      email?: string;
      company?: string;
      password?: string;
    };
    if (!body.username || !body.email || !body.company || !body.password) {
      return NextResponse.json(
        { error: "Semua field wajib diisi." },
        { status: 400 }
      );
    }

    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const companyError = validateCompany(body.company);
    const passwordError = validatePassword(body.password);
    const validationError =
      usernameError ?? emailError ?? companyError ?? passwordError;
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (process.env.TRUST_PROXY === "true") {
      const forwardedFor = req.headers.get("x-forwarded-for");
      const clientIp = forwardedFor?.split(",")[0]?.trim();
      if (clientIp) {
        const ipLimit = rateLimitDb.consume(
          "registration-ip",
          clientIp,
          10,
          REGISTRATION_WINDOW_SECONDS
        );
        if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfterSeconds);
      }
    }

    const identityLimit = rateLimitDb.consume(
      "registration-identity",
      `${username}:${email}`,
      3,
      REGISTRATION_WINDOW_SECONDS
    );
    if (!identityLimit.allowed) {
      return rateLimited(identityLimit.retryAfterSeconds);
    }

    const usernameOwner = userDb.findByUsername(username);
    const emailOwner = userDb.findByEmail(email);
    const samePendingUser =
      usernameOwner &&
      emailOwner &&
      usernameOwner.id === emailOwner.id &&
      !usernameOwner.email_verified;

    if ((usernameOwner || emailOwner) && !samePendingUser) {
      return NextResponse.json(
        { error: "Username atau email sudah digunakan." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const verificationToken = crypto.randomUUID();
    const verificationExpires = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

    if (samePendingUser) {
      userDb.renewPendingRegistration(
        usernameOwner.id,
        passwordHash,
        verificationToken,
        verificationExpires,
        body.company
      );
    } else {
      userDb.create({
        id: crypto.randomUUID(),
        username,
        email,
        password: passwordHash,
        company: body.company,
        role: "viewer",
        verification_token: verificationToken,
        verification_expires: verificationExpires,
      });
    }

    await sendVerificationEmail(email, username, verificationToken);
    return NextResponse.json(
      { ok: true },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[register]", error);
    return NextResponse.json(
      { error: "Pendaftaran gagal. Coba lagi nanti." },
      { status: 500 }
    );
  }
}
