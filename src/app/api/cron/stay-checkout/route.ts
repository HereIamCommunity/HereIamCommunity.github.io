import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { sendCheckoutSMS } from "@/lib/notify";

// 오늘 날짜를 KST 기준 YYYY-MM-DD 형식으로 반환
function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
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

  const today = todayKST();

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

    const checkOut = (row[9] ?? "").trim();
    if (checkOut !== today) continue;

    const name = row[2] ?? "";
    const phone = row[3] ?? "";

    try {
      await sendCheckoutSMS({ name, phone });
      sent.push(`${name} (${phone})`);
      console.log(`[체크아웃 SMS] ✓ ${name} ${phone} 체크아웃 ${today}`);
    } catch (e) {
      console.error(`[체크아웃 SMS] ✗ ${name} ${phone}`, e);
    }
  }

  return NextResponse.json({ today, sent, count: sent.length });
}
