import { NextResponse } from "next/server";
import {
  credentialInstalled,
  credentialUploadAvailable,
} from "@/lib/backup-credential";
import { getDriveBackupStatus } from "@/lib/drive-backup";
import { authorizeApi } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  return NextResponse.json(
    {
      ...getDriveBackupStatus(),
      credentialInstalled: await credentialInstalled(),
      credentialUploadAvailable: credentialUploadAvailable(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
