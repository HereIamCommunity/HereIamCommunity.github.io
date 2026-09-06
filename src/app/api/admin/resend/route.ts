import { NextRequest, NextResponse } from "next/server";
import { parseAdminRow, eventForStatus } from "@/lib/admin-row";
import { notifyBooking } from "@/lib/messaging";

/**
 * 어드민에서 특정 예약의 알림을 다시 보낸다.
 * body: { row: string[] }  — 어드민 목록의 예약 행 (A~O 열)
 * 이벤트는 행의 상태(N열)로 고른다: 신청→received, 입금확인/결제완료→confirmed, 취소→cancelled
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

    const booking = parseAdminRow(row);
    const event = eventForStatus(row[13] ?? "");
    const notify = await notifyBooking(event, booking);

    if (typeof notify.guest === "object") {
      return NextResponse.json(
        { ok: false, error: notify.guest.error, event, notify },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, event, notify });
  } catch (e) {
    console.error("[RESEND ERROR]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
