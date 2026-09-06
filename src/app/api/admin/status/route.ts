import { NextRequest, NextResponse } from "next/server";
import { parseAdminRow } from "@/lib/admin-row";
import { notifyBooking } from "@/lib/messaging";
import { getBookingRow, updateBookingStatus } from "@/lib/sheets";
import type { BookingEvent } from "@/lib/kakao";

/**
 * 어드민에서 예약 상태를 바꾼다 (입금확인 / 취소).
 * body: { row: string[]; action: "confirm" | "cancel" }
 * 이미 같은 상태면 409 (중복 클릭 방지).
 */

const ACTIONS: Record<string, { status: string; event: BookingEvent }> = {
  confirm: { status: "입금확인", event: "confirmed" },
  cancel: { status: "취소", event: "cancelled" },
};

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { row, action } = (await req.json()) as { row: string[]; action: string };

    if (!row || !row[3]) {
      return NextResponse.json({ ok: false, error: "예약 정보가 없습니다." }, { status: 400 });
    }
    const target = ACTIONS[action];
    if (!target) {
      return NextResponse.json({ ok: false, error: "알 수 없는 동작입니다." }, { status: 400 });
    }

    const booking = parseAdminRow(row);

    // 현재 시트 상태 확인 (중복 처리 방지)
    const current = await getBookingRow(booking.type, booking.createdAt ?? "", booking.phone);
    if (!current) {
      return NextResponse.json(
        { ok: false, error: "시트에서 예약 행을 찾지 못했습니다." },
        { status: 404 }
      );
    }
    const currentStatus = (current[13] ?? "").trim();
    if (currentStatus === target.status) {
      return NextResponse.json(
        { ok: false, error: `이미 '${target.status}' 상태입니다.`, status: currentStatus },
        { status: 409 }
      );
    }
    // 입금확인은 '신청'(또는 빈값) 행에서만 가능.
    // 결제완료(토스 승인)·취소 행에 confirm이 오면 상태 하향 + 확정 알림 중복이라 막는다.
    if (action === "confirm" && currentStatus !== "" && currentStatus !== "신청") {
      return NextResponse.json(
        {
          ok: false,
          error: `'${currentStatus}' 상태는 입금확인으로 바꿀 수 없습니다.`,
          status: currentStatus,
        },
        { status: 409 }
      );
    }

    const updated = await updateBookingStatus(
      booking.type,
      booking.createdAt ?? "",
      booking.phone,
      target.status
    );
    if (!updated) {
      return NextResponse.json({ ok: false, error: "상태 저장에 실패했습니다." }, { status: 500 });
    }

    const notify = await notifyBooking(target.event, booking);

    return NextResponse.json({ ok: true, status: target.status, notify });
  } catch (e) {
    console.error("[STATUS ERROR]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
