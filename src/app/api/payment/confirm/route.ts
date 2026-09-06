import { NextRequest, NextResponse } from "next/server";
import { appendBooking } from "@/lib/sheets";
import { sendOperatorAlert, sendGuestConfirmation } from "@/lib/email";
import { notifyBooking } from "@/lib/messaging";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentKey, orderId, amount, bookingData } = body;

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ success: false, message: "필수 파라미터 누락" }, { status: 400 });
    }

    // ── 1. 토스페이먼츠 결제 승인 ─────────────────
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error("[TOSS] 결제 승인 실패:", tossData);
      return NextResponse.json(
        { success: false, message: tossData.message ?? "결제 승인 실패" },
        { status: 400 }
      );
    }

    // ── 2. 결제 완료 ──────────────────────────────
    const createdAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const payload = {
      ...bookingData,
      totalAmount: amount,
    };

    // 예약 저장 (알림 실패가 저장을 막지 않도록 먼저)
    await appendBooking({
      type: bookingData.type,
      createdAt,
      name: bookingData.name,
      phone: bookingData.phone,
      program: bookingData.program,
      date: bookingData.date,
      room: bookingData.room,
      nights: bookingData.nights ? String(bookingData.nights) : undefined,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      discount: bookingData.discount ?? "none",
      totalAmount: amount,
      memo: `[카드결제완료] ${tossData.method ?? ""} · ${tossData.cardNumber ?? tossData.virtualAccount?.accountNumber ?? ""}`,
      status: "결제완료",
    });

    // ── 3. 확정 알림톡/문자 발송 + O열 기록 ─────────
    try {
      await notifyBooking("confirmed", {
        type: bookingData.type === "salon" ? "salon" : "stay",
        createdAt,
        name: bookingData.name,
        phone: bookingData.phone,
        program: bookingData.program,
        date: bookingData.date,
        room: bookingData.room,
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut,
        nights: bookingData.nights ? Number(bookingData.nights) : undefined,
        discount: bookingData.discount ?? "none",
        totalAmount: amount,
        via: "toss",
      });
    } catch (e) {
      console.error("[NOTIFY] ✗ 결제 확정 알림", e);
    }

    // ── 4. 이메일 ──────────────────────────────────
    await Promise.allSettled([
      sendOperatorAlert(payload),
      sendGuestConfirmation(payload),
    ]);

    return NextResponse.json({
      success: true,
      paymentKey: tossData.paymentKey,
      orderId: tossData.orderId,
      method: tossData.method,
    });

  } catch (error) {
    console.error("[PAYMENT CONFIRM ERROR]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
