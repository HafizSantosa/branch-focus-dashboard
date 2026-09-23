import { NextResponse } from "next/server";
import { getDriveBackupStatus } from "@/lib/drive-backup";
import { authorizeApi } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  return NextResponse.json(getDriveBackupStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
