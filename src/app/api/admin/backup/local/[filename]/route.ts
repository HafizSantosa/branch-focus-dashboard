import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
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

  let fileSize: number;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw Object.assign(new Error("not a file"), { code: "ENOENT" });
    fileSize = info.size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ error: "Gagal membaca file." }, { status: 500 });
  }

  // Stream the file instead of buffering it entirely in Node.js heap.
  const stream = createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new Response(webStream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(fileSize),
      "Cache-Control": "no-store",
    },
  });
}
