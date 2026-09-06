import { NextRequest, NextResponse } from "next/server";
import { appendBooking } from "@/lib/sheets";
import { sendOperatorSMS, sendGuestSMS } from "@/lib/notify";
import { sendSalonKakao, sendStayKakao } from "@/lib/kakao";
import { sendOperatorAlert, sendGuestConfirmation } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const createdAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    console.log("[BOOKING]", createdAt, JSON.stringify(data, null, 2));

    const bookingPayload = {
      type: data.type,
      name: data.name,
      phone: data.phone,
      email: data.email,
      program: data.program,
      date: data.date,
      room: data.room,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      nights: data.nights,
      discount: data.discount,
      totalAmount: data.totalAmount,
      memo: data.memo,
    };

    // ── 1. 게스트 SMS 먼저 발송하고 결과를 기록 ──────────
    const hhmm = new Date().toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit",
    });
    let notifyStatus = "";
    try {
      await sendGuestSMS(bookingPayload);
      notifyStatus = `✅ ${hhmm}`;
      console.log("[NOTIFY] ✓ 게스트 SMS");
    } catch (e) {
      notifyStatus = "❌ 실패";
      console.error("[NOTIFY] ✗ 게스트 SMS", e);
    }

    // ── 2. 구글 시트에 저장 (알림 상태 포함) ─────────────
    await appendBooking({
      type: data.type,
      createdAt,
      name: data.name,
      phone: data.phone,
      program: data.program,
      date: data.date,
      room: data.room,
      nights: data.nights ? String(data.nights) : undefined,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      discount: data.discount ?? "none",
      totalAmount: data.totalAmount,
      memo: data.memo,
      status: "신청",
      notifyStatus,
    });

    // ── 3. 나머지 알림 (운영자 이메일 / 게스트 이메일) ────
    const notify = async (label: string, fn: () => Promise<void>) => {
      try {
        await fn();
        console.log(`[NOTIFY] ✓ ${label}`);
      } catch (e) {
        console.error(`[NOTIFY] ✗ ${label}`, e);
      }
    };

    await Promise.all([
      notify("운영자 이메일", () => sendOperatorAlert(bookingPayload)),
      notify("게스트 이메일", () => sendGuestConfirmation(bookingPayload)),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[BOOKING ERROR]", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
