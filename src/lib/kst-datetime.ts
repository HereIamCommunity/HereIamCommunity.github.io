/**
 * 신청일시 문자열 ↔ 실제 시각(instant) — 순수 함수, 서버 시간대와 무관.
 *
 * 앱은 신청일시를 `toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })` 형식
 * ("2026. 9. 6. 오후 7:10:32")으로 만들어 왔다. `digest.ts`의 `parseSheetDateTime`은
 * 이 문자열을 **서버 로컬 시간대** 필드에 담아 돌려준다(화면 계산용). DB에 넣을 실제 시각이
 * 필요할 때는 이 모듈을 쓴다 — Vercel(UTC)에서 parseSheetDateTime 결과를 그대로 넣으면 9시간 어긋난다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const PATTERN = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}):(\d{2})/;

/** "2026. 9. 6. 오후 7:10:32"(KST) → 실제 시각. 형식이 다르면 null. */
export function parseKstDateTime(s: string): Date | null {
  const m = (s ?? "").match(PATTERN);
  if (!m) return null;
  let h = Number(m[5]);
  if (m[4] === "오후" && h < 12) h += 12;
  if (m[4] === "오전" && h === 12) h = 0;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, Number(m[6]), Number(m[7]));
  return new Date(asUtc - KST_OFFSET_MS);
}

/** 실제 시각 → "2026. 9. 6. 오후 7:10:32" (새 신청이 쓰던 형식 그대로) */
export function formatKstDateTime(d: Date): string {
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

/** 실제 시각 → KST "YYYY-MM-DD HH:mm:ss" (일괄 처리 로그·백업 파일명) */
export function kstTimestamp(now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  // sv-SE 로케일은 "2026-09-10 14:32:05" 형태를 준다.
  return p.format(now).replace("T", " ");
}
