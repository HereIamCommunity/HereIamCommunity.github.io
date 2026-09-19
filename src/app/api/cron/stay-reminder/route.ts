import { NextRequest, NextResponse } from "next/server";
import { getAllBookings } from "@/lib/store";
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

  const tomorrow = tomorrowKST();

  // 스테이만. 행 판정(!row[0] 건너뛰기 포함)은 시트 시절 그대로 둔다 —
  // 신청일시가 빈 수기 입력 행에 안내 문자가 새로 나가지 않게.
  const rows = (await getAllBookings()).filter((row) => row[1] === "스테이");
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
