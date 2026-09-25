import { NextResponse } from "next/server";
import { userDb, type UserRole } from "@/lib/db";
import { authorizeApi } from "@/lib/server-auth";

async function authorizeMutation(targetId: string) {
  const authorization = await authorizeApi("admin");
  if (authorization.response) return authorization;
  if (authorization.user.id === targetId) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Tidak dapat mengubah akun sendiri di sini." },
        { status: 400 }
      ),
    };
  }
  return authorization;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response } = await authorizeMutation(id);
  if (response) return response;

  const target = userDb.findById(id);
  if (!target) {
    return NextResponse.json(
      { error: "Pengguna tidak ditemukan." },
      { status: 404 }
    );
  }

  const body = (await req.json()) as { role?: string; active?: boolean };
  if (body.role !== undefined) {
    if (!(["admin", "viewer"] as string[]).includes(body.role)) {
      return NextResponse.json(
        { error: "Role tidak valid." },
        { status: 400 }
      );
    }
    userDb.updateRole(id, body.role as UserRole);
  }
  if (body.active !== undefined) {
    userDb.updateActive(id, body.active ? 1 : 0);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { response } = await authorizeMutation(id);
  if (response) return response;

  if (!userDb.delete(id)) {
    return NextResponse.json(
      { error: "Pengguna tidak ditemukan." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
