import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { userDb, type DbUser, type UserRole } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { authorizeApi } from "@/lib/server-auth";
import {
  normalizeEmail,
  normalizeUsername,
  validateCompany,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/user-input";

function safeUser(user: DbUser) {
  const {
    password: _password,
    verification_token: _verificationToken,
    verification_expires: _verificationExpires,
    ...safe
  } = user;
  void _password;
  void _verificationToken;
  void _verificationExpires;
  return safe;
}


export async function GET() {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  return NextResponse.json(userDb.findAll().map(safeUser), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  try {
    const body = (await req.json()) as {
      username?: string;
      email?: string;
      company?: string;
      password?: string;
      role?: string;
      emailVerified?: boolean;
    };
    if (!body.username || !body.email || !body.password) {
      return NextResponse.json(
        { error: "Username, email, dan password wajib diisi." },
        { status: 400 }
      );
    }

    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(body.password);
    const validationError = usernameError ?? emailError ?? passwordError;
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (body.company) {
      const companyError = validateCompany(body.company);
      if (companyError) {
        return NextResponse.json({ error: companyError }, { status: 400 });
      }
    }

    const role: UserRole = body.role === "admin" ? "admin" : "viewer";
    if (body.role !== undefined && !["admin", "viewer"].includes(body.role)) {
      return NextResponse.json(
        { error: "Role harus 'admin' atau 'viewer'." },
        { status: 400 }
      );
    }
    if (userDb.findByUsername(username) || userDb.findByEmail(email)) {
      return NextResponse.json(
        { error: "Username atau email sudah digunakan." },
        { status: 409 }
      );
    }

    const emailVerified = body.emailVerified === true;
    const passwordHash = await bcrypt.hash(body.password, 12);
    const id = crypto.randomUUID();
    const verificationToken = crypto.randomUUID();
    const verificationExpires = Math.floor(Date.now() / 1000) + 60 * 60 * 24;

    userDb.create({
      id,
      username,
      email,
      company: body.company || null,
      password: passwordHash,
      role,
      email_verified: emailVerified ? 1 : 0,
      active: 1,
      verification_token: emailVerified ? null : verificationToken,
      verification_expires: emailVerified ? null : verificationExpires,
    });

    if (!emailVerified) {
      try {
        await sendVerificationEmail(email, username, verificationToken);
      } catch (error) {
        userDb.delete(id);
        console.error("[admin/users:POST] Failed to send email:", error);
        return NextResponse.json(
          { error: "Email verifikasi gagal dikirim; pengguna tidak dibuat." },
          { status: 502 }
        );
      }
    }

    const created = userDb.findById(id);
    if (!created) {
      return NextResponse.json(
        { error: "Gagal membuat pengguna." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: true, user: safeUser(created) },
      { status: 201 }
    );
  } catch (error) {
    console.error("[admin/users:POST]", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
