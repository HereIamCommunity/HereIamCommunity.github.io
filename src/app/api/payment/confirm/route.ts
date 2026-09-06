import { NextRequest, NextResponse } from "next/server";
import { appendBooking } from "@/lib/sheets";
import { sendOperatorAlert, sendGuestConfirmation } from "@/lib/email";
import { sendOperatorSMS, sendGuestSMS } from "@/lib/notify";

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

    // 게스트 SMS 먼저 발송하고 결과를 기록
    const hhmm = new Date().toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit",
    });
    let notifyStatus = "";
    try {
      await sendGuestSMS(payload);
      notifyStatus = `✅ ${hhmm}`;
    } catch (e) {
      notifyStatus = "❌ 실패";
      console.error("[NOTIFY] ✗ 게스트 SMS (결제)", e);
    }

    // 예약 저장 (알림 상태 포함)
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
      notifyStatus,
    });

    // ── 3. 나머지 알림 발송 ────────────────────────
    await Promise.allSettled([
      sendOperatorAlert(payload),
      sendGuestConfirmation(payload),
      sendOperatorSMS(payload),
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
