import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { sendCheckinReminderSMS } from "@/lib/notify";

// 내일 날짜를 KST 기준 YYYY-MM-DD 형식으로 반환
function tomorrowKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setDate(kst.getDate() + 1);
  return kst.toISOString().slice(0, 10);
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

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values
    .get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: "스테이!A:N" })
    .catch(() => ({ data: { values: [] } }));

  const rows = (res.data.values as string[][] | null) ?? [];
  const sent: string[] = [];

  for (const row of rows) {
    if (!row[0] || row[0] === "신청일시") continue;
    const status = row[13] ?? "";
    if (status === "취소") continue;

    const checkIn = (row[8] ?? "").trim();
    if (checkIn !== tomorrow) continue;

    const name = row[2] ?? "";
    const phone = row[3] ?? "";
    const room = row[6] ?? "";
    const checkOut = row[9] ?? "";

    try {
      await sendCheckinReminderSMS({ name, phone, room, checkIn, checkOut });
      sent.push(`${name} (${phone})`);
      console.log(`[D-1 SMS] ✓ ${name} ${phone} 체크인 ${checkIn}`);
    } catch (e) {
      console.error(`[D-1 SMS] ✗ ${name} ${phone}`, e);
    }
  }

  return NextResponse.json({ tomorrow, sent, count: sent.length });
}
