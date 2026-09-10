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
import type { RowRef } from "@/lib/row-ref";

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

function nowHHMM(now: Date = new Date()) {
  // 설계 3.5의 O열 형식 "✅ 14:32 접수" — 24시간 표기 고정
  return now.toLocaleTimeString("ko-KR", {
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
  else if (guest === "skipped") {
    const why = result.guestSkipReason ? `(${result.guestSkipReason})` : "";
    base = `⏭ ${nowHHMM()} ${short} 건너뜀${why}`;
  }
  else base = `❌ ${short} 실패: ${guest.error}`;

  const hostFailed = typeof result.host === "object";
  return hostFailed ? `${base} (호스트 ❌)` : base;
}

/**
 * notify:false 로 처리한 건의 O열 문구 — "🔕 14:32 확정 알림 없음"
 * `now`는 **실제 시각(instant)** — 표기는 항상 KST로 변환한다. 일괄 처리는 한 잡의 모든 행에
 * 같은 시각을 쓰려고 이 인자를 넘긴다.
 */
export function silentStatusText(event: BookingEvent, now: Date = new Date()): string {
  return `🔕 ${nowHHMM(now)} ${EVENT_SHORT[event]} 알림 없음`;
}

export async function notifyBooking(
  event: BookingEvent,
  booking: Booking,
  opts?: { recordToSheet?: boolean; ref?: RowRef }
): Promise<NotifyResult> {
  const result = await sendBookingMessages(event, booking);

  let sheetRecorded = false;
  if (opts?.recordToSheet !== false) {
    try {
      sheetRecorded = await updateNotifyStatus(
        booking.type,
        booking.createdAt ?? "",
        booking.phone,
        notifyStatusText(event, result),
        opts?.ref
      );
    } catch (e) {
      console.error("[NOTIFY] 시트 기록 실패", e);
    }
  }

  // 호스트는 채널까지 남긴다 — "host=ok@slack" / "host=ok@sms" / "host=skipped@none"
  const hostLabel = `${resultLabel(result.host)}@${result.hostChannel ?? "none"}`;
  console.log(
    `[NOTIFY] event=${event} guest=${resultLabel(result.guest)} host=${hostLabel}` +
      ` groupId=${result.groupId ?? "-"} sheet=${sheetRecorded}`
  );

  return { ...result, sheetRecorded };
}
