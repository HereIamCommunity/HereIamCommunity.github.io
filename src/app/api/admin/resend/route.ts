import { NextRequest, NextResponse } from "next/server";
import { parseAdminRow, eventForStatus } from "@/lib/admin-row";
import { notifyBooking } from "@/lib/messaging";
import { normalizeRowRef } from "@/lib/row-ref";

/**
 * 어드민에서 특정 예약의 알림을 다시 보낸다.
 * body: { row: string[]; ref?: { tab: "살롱"|"스테이"; rowNum: number } }
 *   row  — 어드민 목록의 예약 행 (A~O 열)
 *   ref  — 목록 응답의 meta 원소. 있으면 O열 기록을 그 행에 직접 한다.
 *
 * 이벤트는 행의 상태(N열)로 고른다: 신청→received, 입금확인/결제완료→confirmed, 취소→cancelled
 * 연락처가 없으면 게스트는 skipped(사유 "연락처 없음")로 두고 호스트 문자만 나간다.
 */
export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { row?: unknown; ref?: unknown };
    if (!Array.isArray(body.row) || body.row.length === 0) {
      return NextResponse.json({ ok: false, error: "예약 정보가 없습니다." }, { status: 400 });
    }

    const row = (body.row as unknown[]).map((c) => (c == null ? "" : String(c)));
    const ref = normalizeRowRef(body.ref) ?? undefined;

    const booking = parseAdminRow(row);
    const event = eventForStatus(row[13] ?? "");
    const notify = await notifyBooking(event, booking, { ref });

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
