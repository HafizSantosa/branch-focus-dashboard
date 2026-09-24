import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/server-auth";
import {
  getLocalBackupConfig,
  getLocalBackupStatus,
  listLocalBackups,
  runLocalBackup,
} from "@/lib/local-backup";

export const runtime = "nodejs";

export async function GET() {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  try {
    const [status, files] = await Promise.all([
      Promise.resolve(getLocalBackupStatus()),
      listLocalBackups(),
    ]);
    const config = getLocalBackupConfig();
    return NextResponse.json(
      { ...status, files, backupDir: config.backupDir },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat status backup." },
      { status: 500 }
    );
  }
}

export async function POST() {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  try {
    const result = await runLocalBackup();
    const files = await listLocalBackups();
    return NextResponse.json({ ...result, files });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Backup gagal dijalankan.",
      },
      { status: 500 }
    );
  }
}
