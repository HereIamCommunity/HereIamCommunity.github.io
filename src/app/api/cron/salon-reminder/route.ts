import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { sendSalonReminderSMS } from "@/lib/notify";

// 내일 날짜를 KST 기준 YYYY-MM-DD 형식으로 반환
function tomorrowKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setDate(kst.getDate() + 1);
  return kst.toISOString().slice(0, 10);
}

// "10월 21일 (수) 19:30" → "YYYY-MM-DD"
function salonDateISO(s: string, year: number): string {
  if (!s) return "";
  const m = s.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (m) return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "";
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ skipped: true, reason: "no sheets config" });
  }

  const tomorrow = tomorrowKST();
  const year = Number(tomorrow.slice(0, 4));

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values
    .get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "살롱!A:O" })
    .catch(() => ({ data: { values: [] } }));

  const rows = (res.data.values as string[][] | null) ?? [];
  const sent: string[] = [];

  for (const row of rows) {
    if (!row[0] || row[0] === "신청일시") continue;
    const status = (row[13] ?? "").trim();
    if (status === "취소") continue;

    const dateStr = (row[5] ?? "").trim();
    if (salonDateISO(dateStr, year) !== tomorrow) continue;

    const name = row[2] ?? "";
    const phone = row[3] ?? "";
    const program = row[4] ?? "";

    try {
      await sendSalonReminderSMS({ name, phone, program, date: dateStr });
      sent.push(`${name} (${phone})`);
      console.log(`[살롱 D-1] ✓ ${name} ${phone} 일시 ${dateStr}`);
    } catch (e) {
      console.error(`[살롱 D-1] ✗ ${name} ${phone}`, e);
    }
  }

  return NextResponse.json({ tomorrow, sent, count: sent.length });
}
