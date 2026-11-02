import { NextRequest, NextResponse } from "next/server";
import { appendBooking, getSalonCounts, getActiveStayBookings } from "@/lib/sheets";
import { isBookingFull } from "@/lib/programs";
import { notifyBooking } from "@/lib/messaging";
import { sendOperatorAlert, sendGuestConfirmation } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const createdAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    console.log("[BOOKING]", createdAt, JSON.stringify(data, null, 2));

    // ── 0. 정원이 있으면 마감을 서버에서 다시 확인 ──────────────
    if (data.type === "salon") {
      const counts = await getSalonCounts();

      if (Array.isArray(data.selections) && data.selections.length > 0) {
        // 멀티 프로그램: 각각 정원 확인
        for (const sel of data.selections as { program: string; date: string; price: number }[]) {
          if (isBookingFull(sel.program, sel.date, counts)) {
            console.log(`[BOOKING] 마감 거절 — ${sel.program} / ${sel.date}`);
            return NextResponse.json(
              { success: false, message: `'${sel.program}' 이(가) 방금 마감되었습니다. 다시 확인해주세요.` },
              { status: 409 }
            );
          }
        }
      } else {
        if (isBookingFull(data.program, data.date, counts)) {
          console.log(`[BOOKING] 마감 거절 — ${data.program} / ${data.date}`);
          return NextResponse.json(
            { success: false, message: "방금 마감되었습니다. 다른 날짜나 시간대를 선택해주세요." },
            { status: 409 }
          );
        }
      }
    }

    if (data.type === "stay" && data.room && data.checkIn && data.checkOut) {
      const existing = await getActiveStayBookings(data.room);
      const hasOverlap = existing.some(
        (b) => data.checkIn < b.checkOut && b.checkIn < data.checkOut
      );
      if (hasOverlap) {
        console.log(`[BOOKING] 스테이 중복 거절 — ${data.room} / ${data.checkIn}~${data.checkOut}`);
        return NextResponse.json(
          { success: false, message: "선택하신 날짜에 이미 예약이 있습니다. 다른 날짜를 선택해주세요." },
          { status: 409 }
        );
      }
    }

    const isMulti = Array.isArray(data.selections) && data.selections.length > 0;
    type Selection = { program: string; date: string; price: number };

    // ── 1. 구글 시트에 저장 (알림 실패가 저장을 막지 않도록 먼저) ──
    if (isMulti) {
      const isMember = data.discount === "geot";
      for (const sel of data.selections as Selection[]) {
        const indivAmount = isMember ? 0 : sel.price;
        await appendBooking({
          type: "salon",
          createdAt,
          name: data.name,
          phone: data.phone,
          program: sel.program,
          date: sel.date,
          discount: data.discount ?? "none",
          totalAmount: indivAmount,
          memo: data.memo,
          status: "신청",
        });
      }
    } else {
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
    }

    // 알림·이메일용 단일 payload (멀티 신청이면 합산 요약)
    const notifyProgram = isMulti
      ? (data.selections as Selection[]).map((s) => s.program).join("\n")
      : data.program;
    const notifyDate = isMulti
      ? (data.selections as Selection[]).map((s) => s.date).join(" / ")
      : data.date;

    const bookingPayload = {
      type: data.type,
      name: data.name,
      phone: data.phone,
      email: data.email,
      program: notifyProgram,
      date: notifyDate,
      room: data.room,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      nights: data.nights,
      discount: data.discount,
      totalAmount: data.totalAmount,
      memo: data.memo,
    };

    // ── 2. 접수 알림톡/문자 발송 + O열 기록 ─────────────
    try {
      await notifyBooking("received", {
        type: data.type === "salon" ? "salon" : "stay",
        createdAt,
        name: data.name,
        phone: data.phone,
        program: notifyProgram,
        date: notifyDate,
        room: data.room,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        nights: data.nights ? Number(data.nights) : undefined,
        discount: data.discount ?? "none",
        totalAmount: data.totalAmount ?? 0,
        via: "web",
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
