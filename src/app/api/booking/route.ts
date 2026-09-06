import { NextRequest, NextResponse } from "next/server";
import { appendBooking } from "@/lib/sheets";
import { notifyBooking } from "@/lib/messaging";
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

    // ── 1. 구글 시트에 저장 (알림 실패가 저장을 막지 않도록 먼저) ──
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
    });

    // ── 2. 접수 알림톡/문자 발송 + O열 기록 ─────────────
    try {
      await notifyBooking("received", {
        type: data.type === "salon" ? "salon" : "stay",
        createdAt,
        name: data.name,
        phone: data.phone,
        program: data.program,
        date: data.date,
        room: data.room,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        nights: data.nights ? Number(data.nights) : undefined,
        discount: data.discount ?? "none",
        totalAmount: data.totalAmount ?? 0,
      });
    } catch (e) {
      console.error("[NOTIFY] ✗ 접수 알림", e);
    }

    // ── 3. 이메일 (운영자 / 게스트) ────────────────────
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
