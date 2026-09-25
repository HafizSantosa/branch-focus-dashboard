import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/server-auth";
import { getConfiguredSheetUrl } from "@/lib/parse-csv";
import { syncSheetSnapshot } from "@/lib/data-sync";


export async function GET() {
  const { response } = await authorizeApi("admin");
  if (response) return response;
  return NextResponse.json(
    { sheetUrl: getConfiguredSheetUrl() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(req: Request) {
  const { response } = await authorizeApi("admin");
  if (response) return response;

  try {
    const body = (await req.json()) as { sheetUrl?: string };
    if (!body.sheetUrl) {
      return NextResponse.json(
        { error: "URL Google Spreadsheet wajib diisi." },
        { status: 400 }
      );
    }

    const snapshot = await syncSheetSnapshot(body.sheetUrl, true);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pengaturan spreadsheet gagal disimpan.",
      },
      { status: 400 }
    );
  }
}
