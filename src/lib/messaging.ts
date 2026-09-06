/**
 * 예약 알림 오케스트레이션.
 * API 라우트는 이 파일의 notifyBooking만 호출한다.
 *   발송(솔라피) → 구글 시트 O열 기록 → 로그 → 결과 반환.
 */

import {
  sendBookingMessages,
  type Booking,
  type BookingEvent,
  type SendBookingResult,
  type SendResult,
} from "@/lib/kakao";
import { updateNotifyStatus } from "@/lib/sheets";

const EVENT_SHORT: Record<BookingEvent, string> = {
  received: "접수",
  confirmed: "확정",
  cancelled: "취소",
};

export type NotifyResult = SendBookingResult & { sheetRecorded: boolean };

function resultLabel(r: SendResult): string {
  if (r === "ok") return "ok";
  if (r === "skipped") return "skipped";
  return `error(${r.error})`;
}

function nowHHMM() {
  // 설계 3.5의 O열 형식 "✅ 14:32 접수" — 24시간 표기 고정
  return new Date().toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** O열에 기록할 문구. 성공 "✅ 14:32 접수" / 실패 "❌ 확정 실패: 사유" */
export function notifyStatusText(event: BookingEvent, result: SendBookingResult): string {
  const short = EVENT_SHORT[event];
  const guest = result.guest;

  let base: string;
  if (guest === "ok") base = `✅ ${nowHHMM()} ${short}`;
  else if (guest === "skipped") base = `⏭ ${nowHHMM()} ${short} 건너뜀`;
  else base = `❌ ${short} 실패: ${guest.error}`;

  const hostFailed = typeof result.host === "object";
  return hostFailed ? `${base} (호스트 ❌)` : base;
}

export async function notifyBooking(
  event: BookingEvent,
  booking: Booking,
  opts?: { recordToSheet?: boolean }
): Promise<NotifyResult> {
  const result = await sendBookingMessages(event, booking);

  let sheetRecorded = false;
  if (opts?.recordToSheet !== false) {
    try {
      sheetRecorded = await updateNotifyStatus(
        booking.type,
        booking.createdAt ?? "",
        booking.phone,
        notifyStatusText(event, result)
      );
    } catch (e) {
      console.error("[NOTIFY] 시트 기록 실패", e);
    }
  }

  console.log(
    `[NOTIFY] event=${event} guest=${resultLabel(result.guest)} host=${resultLabel(result.host)}` +
      ` groupId=${result.groupId ?? "-"} sheet=${sheetRecorded}`
  );

  return { ...result, sheetRecorded };
}
