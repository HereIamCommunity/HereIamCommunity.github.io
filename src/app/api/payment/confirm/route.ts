import { NextRequest, NextResponse } from "next/server";
import { appendBooking } from "@/lib/sheets";
import { sendOperatorAlert, sendGuestConfirmation } from "@/lib/email";
import { notifyBooking } from "@/lib/messaging";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";

type Selection = { program: string; date: string; price: number };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentKey, orderId, amount, bookingData } = body as {
      paymentKey: string;
      orderId: string;
      amount: number;
      bookingData: Record<string, unknown>;
    };

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ success: false, message: "필수 파라미터 누락" }, { status: 400 });
    }
    if (!TOSS_SECRET_KEY) {
      return NextResponse.json({ success: false, message: "결제 서버 설정 오류 (TOSS_SECRET_KEY 미설정)" }, { status: 500 });
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

    // ── 2. 구글 시트에 저장 ─────────────────────
    const createdAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const payMemo = `[카드결제] ${tossData.method ?? ""} · ${tossData.cardNumber ?? tossData.virtualAccount?.accountNumber ?? ""}`;

    const isMulti = Array.isArray(bookingData.selections) && (bookingData.selections as Selection[]).length > 0;

    if (isMulti) {
      // 살롱 멀티 프로그램: 프로그램마다 행 저장
      const isMember = bookingData.discount === "geot";
      for (const sel of bookingData.selections as Selection[]) {
        const indivAmount = isMember ? 0 : sel.price;
        await appendBooking({
          type: "salon",
          createdAt,
          name: bookingData.name as string,
          phone: bookingData.phone as string,
          program: sel.program,
          date: sel.date,
          discount: (bookingData.discount as string) ?? "none",
          totalAmount: indivAmount,
          memo: payMemo,
          status: "결제완료",
        });
      }
    } else {
      await appendBooking({
        type: bookingData.type as string,
        createdAt,
        name: bookingData.name as string,
        phone: bookingData.phone as string,
        program: bookingData.program as string | undefined,
        date: bookingData.date as string | undefined,
        room: bookingData.room as string | undefined,
        nights: bookingData.nights ? String(bookingData.nights) : undefined,
        checkIn: bookingData.checkIn as string | undefined,
        checkOut: bookingData.checkOut as string | undefined,
        discount: (bookingData.discount as string) ?? "none",
        totalAmount: amount,
        memo: payMemo,
        status: "결제완료",
      });
    }

    // ── 3. 확정 알림 ─────────────────────────────
    const notifyProgram = isMulti
      ? (bookingData.selections as Selection[]).map((s) => s.program).join("\n")
      : (bookingData.program as string | undefined);
    const notifyDate = isMulti
      ? (bookingData.selections as Selection[]).map((s) => s.date).join(" / ")
      : (bookingData.date as string | undefined);

    try {
      await notifyBooking("confirmed", {
        type: bookingData.type === "stay" ? "stay" : "salon",
        createdAt,
        name: bookingData.name as string,
        phone: bookingData.phone as string,
        program: notifyProgram,
        date: notifyDate,
        room: bookingData.room as string | undefined,
        checkIn: bookingData.checkIn as string | undefined,
        checkOut: bookingData.checkOut as string | undefined,
        nights: bookingData.nights ? Number(bookingData.nights) : undefined,
        discount: (bookingData.discount as string) ?? "none",
        totalAmount: amount,
        via: "toss",
      });
    } catch (e) {
      console.error("[NOTIFY] ✗ 결제 확정 알림", e);
    }

    // ── 4. 이메일 ───────────────────────────────
    const emailPayload = {
      ...bookingData,
      program: notifyProgram,
      date: notifyDate,
      totalAmount: amount,
    };
    await Promise.allSettled([
      sendOperatorAlert(emailPayload as Parameters<typeof sendOperatorAlert>[0]),
      sendGuestConfirmation(emailPayload as Parameters<typeof sendGuestConfirmation>[0]),
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
