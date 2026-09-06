import { NextRequest, NextResponse } from "next/server";
import { sendGuestSMS } from "@/lib/notify";
import { updateNotifyStatus } from "@/lib/sheets";

/**
 * 관리자 페이지에서 특정 예약의 게스트 확정 안내 SMS 재발송.
 * body: { row: string[] }  — 어드민 목록의 예약 행 (A~O 열)
 * 열: 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수 8체크인 9체크아웃 10할인 11금액 12요청 13상태 14알림
 */
export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { row } = (await req.json()) as { row: string[] };
    if (!row || !row[3]) {
      return NextResponse.json({ ok: false, error: "예약 정보가 없습니다." }, { status: 400 });
    }

    const type = row[1] === "살롱" ? "salon" : "stay";
    const discountRaw = row[10] || "";
    const discount = discountRaw.includes("곁")
      ? "geot"
      : discountRaw.includes("나그네")
      ? "nagnae"
      : "none";

    const payload = {
      type: type as "salon" | "stay",
      name: row[2] || "",
      phone: row[3] || "",
      program: row[4] || undefined,
      date: row[5] || undefined,
      room: row[6] || undefined,
      nights: row[7] ? Number(row[7]) : undefined,
      checkIn: row[8] || undefined,
      checkOut: row[9] || undefined,
      discount,
      totalAmount: parseInt((row[11] ?? "0").replace(/[^0-9]/g, "")) || 0,
    };

    await sendGuestSMS(payload);

    const hhmm = new Date().toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit",
    });
    await updateNotifyStatus(type, row[0] || "", row[3] || "", `✅ ${hhmm} (재발송)`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[RESEND ERROR]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
