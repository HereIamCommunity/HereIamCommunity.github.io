import { normalizeDate, parseSheetDateTime } from "@/lib/digest";

/** 시트 한 행 (예약 A~O · 리트릿 A~M · 무료개방 A~L) */
export type Row = string[];

export type RowMsg = { ok: boolean; text: string };

/** 상태를 바꿀 수 있는 시트 종류 (`POST /api/admin/status`의 sheet 파라미터) */
export type SheetKind = "booking" | "retreat" | "open";
export type StatusAction = "confirm" | "cancel" | "reopen";

/** 목록·오늘·리트릿·무료개방 탭이 공유하는 행 액션 묶음 */
export type AdminActions = {
  busyKey: string | null;
  rowMsg: Record<string, RowMsg>;
  changeStatus: (sheet: SheetKind, row: Row, action: StatusAction, reason?: string) => void;
  resend: (row: Row) => void;
};

export const ROOM_NAMES: Record<string, string> = {
  nagnae: "나그네방",
  oksun: "옥순방",
  yeutae: "여태방",
};
export const ROOM_KEYS = ["nagnae", "oksun", "yeutae"] as const;
export type RoomKey = (typeof ROOM_KEYS)[number];

/** 행 식별 키 — 신청일시 + 연락처 (시트 업데이트가 쓰는 것과 같은 조합) */
export function rowKey(sheet: SheetKind, row: Row): string {
  const phone = sheet === "booking" ? row[3] : row[2];
  return `${sheet}:${row[0] ?? ""}|${phone ?? ""}`;
}

/** 예약 행의 상태(N열). 빈값은 "신청"으로 본다. */
export function bookingStatus(row: Row): string {
  return (row[13] ?? "").trim() || "신청";
}

export function retreatStatus(row: Row): string {
  return (row[12] ?? "").trim() || "신청";
}

export function openStayStatus(row: Row): string {
  return (row[11] ?? "").trim() || "신청";
}

/** "120000" · "120,000원" → "120,000원" */
export function amountText(raw: string | undefined): string {
  const n = parseInt((raw ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
  return `${n.toLocaleString()}원`;
}

export function amountNumber(raw: string | undefined): number {
  return parseInt((raw ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
}

/** Date → "YYYY-MM-DD" (parseSheetDateTime이 이미 KST로 맞춰 돌려준다) */
export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toDateStr(y: number, monthIndex: number, day: number): string {
  const d = new Date(y, monthIndex, day);
  return isoOf(d);
}

/** "2026-09-06" → "9/6(일)" — 표·카드에서 쓰는 짧은 날짜 */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return iso ?? "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${Number(m[2])}/${Number(m[3])}(${dow})`;
}

/** 신청일시 문자열 → "9/6 19:10" */
export function shortDateTime(raw: string): string {
  const d = parseSheetDateTime(raw ?? "");
  if (!d) return raw ?? "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 연락처를 tel: 링크용으로 정리 */
export function telHref(phone: string | undefined): string {
  return `tel:${(phone ?? "").replace(/[^0-9+]/g, "")}`;
}

/** 예약의 "내용" 한 줄 — 살롱은 프로그램, 스테이는 객실 */
export function contentOf(row: Row): string {
  return row[4] || row[6] || "—";
}

/** 예약의 "일시" 한 줄 — 살롱은 F열, 스테이는 체크인→체크아웃 */
export function whenOf(row: Row): string {
  if (row[1] === "스테이") {
    if (row[8] && row[9]) return `${shortDate(row[8])} → ${shortDate(row[9])}`;
    if (row[8]) return `${shortDate(row[8])} →`;
    return "—";
  }
  return row[5] || "—";
}

export type NotifyKind = "sent" | "failed" | "skipped" | "none";

/** O열(알림) 셀을 종류 + 표시 텍스트로 나눈다. 이모지는 우리 UI에서 색 점으로 바꾼다. */
export function parseNotifyCell(cell: string | undefined): { kind: NotifyKind; text: string } {
  const raw = (cell ?? "").trim();
  if (!raw) return { kind: "none", text: "미발송" };
  if (raw.startsWith("✅")) return { kind: "sent", text: raw.replace(/^✅\s*/, "") || "발송됨" };
  if (raw.startsWith("❌")) return { kind: "failed", text: raw.replace(/^❌\s*/, "") || "발송 실패" };
  if (raw.startsWith("⏭")) return { kind: "skipped", text: "건너뜀(템플릿 미설정)" };
  return { kind: "none", text: raw };
}

export type Period = "오늘" | "이번 주" | "이번 달" | "전체";
export type TypeFilter = "전체" | "살롱" | "스테이";
export type StatusFilter = "전체" | "입금대기" | "확정" | "취소";

/** 신청일시 기준 기간 필터 */
export function inPeriod(createdAt: string, period: Period, todayISO: string): boolean {
  if (period === "전체") return true;
  const d = parseSheetDateTime(createdAt ?? "");
  if (!d) return false;
  const iso = isoOf(d);
  if (period === "오늘") return iso === todayISO;

  const [y, m, day] = todayISO.split("-").map(Number);
  const today = new Date(y, m - 1, day);
  if (period === "이번 주") {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return iso >= isoOf(start);
  }
  // 이번 달
  return iso.slice(0, 7) === todayISO.slice(0, 7);
}

/* ── 버튼 클래스 (최소 44px 타깃 · 라벨은 항상 한 줄) ── */
export const BTN_BASE =
  "inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
export const BTN_PRIMARY = `${BTN_BASE} bg-brown text-white hover:bg-brown/85`;
export const BTN_CONFIRM = `${BTN_BASE} bg-teal text-white hover:bg-teal-dark`;
export const BTN_OUTLINE = `${BTN_BASE} border border-gray-300 text-gray-700 hover:border-brown hover:text-brown bg-white`;
export const BTN_DANGER = `${BTN_BASE} border border-orange-dark bg-orange/10 text-brown hover:bg-orange/20`;
/** 표 안에서만 쓰는 작은 버튼 — 그래도 세로 타깃 36px + nowrap */
export const BTN_SMALL =
  "inline-flex items-center justify-center min-h-[36px] px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40 border bg-white";

/* ── 스테이 캘린더 계산 (문자열 비교 전에 normalizeDate로 통일) ── */
export type DateRange = { start: string; end: string };
export type DayStatus = "website" | "airbnb" | "both" | "available";

/** 체크인 ≤ d < 체크아웃 이면 그 방은 그 날 웹사이트 예약으로 찬 것 */
export function dayStatus(
  stayRows: Row[],
  airbnbRanges: Record<string, DateRange[]>,
  dateStr: string,
  roomKey: string
): DayStatus {
  const roomName = ROOM_NAMES[roomKey];
  const isWebsite = stayRows.some((r) => {
    if (r[6] !== roomName || !r[8] || !r[9]) return false;
    const inDate = normalizeDate(r[8]);
    const outDate = normalizeDate(r[9]);
    return dateStr >= inDate && dateStr < outDate;
  });
  const isAirbnb = (airbnbRanges[roomKey] ?? []).some(
    (r) => dateStr >= normalizeDate(r.start) && dateStr <= normalizeDate(r.end)
  );
  if (isWebsite && isAirbnb) return "both";
  if (isWebsite) return "website";
  if (isAirbnb) return "airbnb";
  return "available";
}

/** 오늘부터 N일 안에 웹사이트·에어비앤비가 겹치는 날 (이중예약 경고용) */
export function findConflicts(
  stayRows: Row[],
  airbnbRanges: Record<string, DateRange[]>,
  fromISO: string,
  days = 60
): { room: string; date: string }[] {
  const [y, m, d] = fromISO.split("-").map(Number);
  if (!y || !m || !d) return [];
  const out: { room: string; date: string }[] = [];
  for (let i = 0; i < days; i++) {
    const cur = new Date(y, m - 1, d + i);
    const iso = isoOf(cur);
    for (const key of ROOM_KEYS) {
      if (dayStatus(stayRows, airbnbRanges, iso, key) === "both") {
        out.push({ room: ROOM_NAMES[key], date: iso });
      }
    }
  }
  return out;
}
