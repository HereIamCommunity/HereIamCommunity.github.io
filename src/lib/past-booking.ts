/**
 * 지난 예약 판정 — 사용일이 컷오프 이전이면 게스트 알림톡을 보내지 않는다.
 * 운영 요청(2026-09-10): 알림톡 승인 전에 쌓인 과거 예약을 입금확인 처리해도 게스트에게 알림이 가면 안 된다.
 * 호스트 문자·상태 변경은 그대로 진행한다.
 */
import { normalizeDate } from "@/lib/digest";

export const GUEST_NOTIFY_CUTOFF = "2026-09-10";

type Usage = { type: "salon" | "stay"; date?: string; checkIn?: string };

/** 사용일 ISO(YYYY-MM-DD). 스테이=체크인, 살롱=일시. 판정 불가면 "" */
export function usageDateISO(b: Usage, now: Date = new Date()): string {
  const raw = b.type === "stay" ? (b.checkIn ?? "") : (b.date ?? "");
  if (!raw) return "";
  const n = normalizeDate(raw);
  const iso = n.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const m = raw.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (m) {
    const y = now.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 4);
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return "";
}

/** 사용일 < 컷오프 → 지난 예약. 사용일을 모르면 false(발송 유지). */
export function isPastBooking(b: Usage, now: Date = new Date()): boolean {
  const d = usageDateISO(b, now);
  return !!d && d < GUEST_NOTIFY_CUTOFF;
}
