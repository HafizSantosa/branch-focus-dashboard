import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/server-auth";
import { getLocalBackupConfig } from "@/lib/local-backup";

export const runtime = "nodejs";

const SAFE_NAME = /^LOP_Detail_Unfiltered_\d{4}-\d{2}-\d{2}\.csv$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  const { filename } = await params;

  if (!SAFE_NAME.test(filename)) {
    return NextResponse.json({ error: "Nama file tidak valid." }, { status: 400 });
  }

  const config = getLocalBackupConfig();
  const filePath = path.join(config.backupDir, filename);

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  const content = await readFile(filePath);

  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
