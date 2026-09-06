import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ counts: {} });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "살롱!A:N",
    });

    const rows = (res.data.values as string[][] | null) ?? [];
    const counts: Record<string, number> = {};

    for (const row of rows) {
      if (!row[0] || row[0] === "신청일시") continue;
      const status = row[13] ?? "";
      if (status === "취소") continue;
      const program = row[4] ?? "";
      if (!program) continue;
      counts[program] = (counts[program] ?? 0) + 1;
    }

    return NextResponse.json({ counts });
  } catch (e) {
    console.error("[program-counts]", e);
    return NextResponse.json({ counts: {} });
  }
}
