import { NextResponse } from "next/server";
import {
  CredentialUploadError,
  credentialUploadAvailable,
  readCredentialUpload,
  storeServiceAccountKey,
} from "@/lib/backup-credential";
import { getDriveBackupConfig, runDriveBackup } from "@/lib/drive-backup";
import { authorizeApi } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  const expectedOrigin = new URL(
    process.env.NEXTAUTH_URL || request.url
  ).origin;
  if (request.headers.get("origin") !== expectedOrigin) {
    return NextResponse.json({ error: "Asal permintaan tidak valid." }, { status: 403 });
  }
  if (request.headers.get("content-type") !== "application/json") {
    return NextResponse.json({ error: "Pilih file JSON service account." }, { status: 415 });
  }
  if (!credentialUploadAvailable()) {
    return NextResponse.json(
      { error: "Kredensial sudah dipasang dari luar container." },
      { status: 409 }
    );
  }

  try {
    const bytes = await readCredentialUpload(request);
    const email = await storeServiceAccountKey(bytes);
    const config = getDriveBackupConfig();
    if (config.configured) {
      // The first backup starts immediately so administrators can check Drive access.
      void runDriveBackup().catch(() => {
        // The backup service records and logs failures for the admin status panel.
      });
    }
    return NextResponse.json(
      { email },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof CredentialUploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[drive-backup] Unable to save service account key:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan kredensial backup." },
      { status: 500 }
    );
  }
}
