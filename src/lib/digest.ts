/**
 * 어드민 '오늘' 탭과 morning-digest 크론이 공유하는 순수 집계 로직.
 *
 * 시트 I/O·네트워크 없음 — 받은 배열만 보고 계산한다(클라이언트에서도 그대로 쓴다).
 *
 * 예약 행(A~O): 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수
 *               8체크인 9체크아웃 10할인 11결제금액 12요청사항 13상태 14알림
 * 리트릿 행(A~M): 0신청일시 1이름 2연락처 3학년나이 4거주지역 5회차 … 12상태
 *
 * 시각 규약: 이 파일의 Date는 전부 "KST 벽시계를 로컬 필드에 담은 Date"다.
 * (`new Date(2026, 8, 7, 9, 0)` = KST 2026-09-07 09:00). 기존 크론과 같은 방식.
 */

import { RETREAT_SESSIONS } from "@/lib/retreat-sessions";

const CANCELLED = "취소";

/** 시트에서 읽힌 날짜를 "YYYY-MM-DD"로 정규화. 못 읽으면 원문 그대로. */
export function normalizeDate(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // "2026. 7. 9." / "2026.7.9" / "2026-07-09 19:00" / "2026/7/9"
  const m = s.match(/(\d{4})[.\s/-]+(\d{1,2})[.\s/-]+(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s;
}

/** "2026. 9. 6. 오후 7:10:32" → Date(KST 벽시계). 형식이 다르면 null. */
export function parseSheetDateTime(s: string): Date | null {
  const m = s?.match(
    /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}):(\d{2})/
  );
  if (!m) return null;
  let h = parseInt(m[5], 10);
  if (m[4] === "오후" && h < 12) h += 12;
  if (m[4] === "오전" && h === 12) h = 0;
  return new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
    h,
    parseInt(m[6], 10),
    parseInt(m[7], 10)
  );
}

/** 지금(또는 offsetDays만큼 옮긴) KST 날짜를 "YYYY-MM-DD"로. */
export function kstToday(offsetDays = 0): string {
  const d = kstNow();
  d.setDate(d.getDate() + offsetDays);
  return toISODate(d);
}

/** 확정으로 볼 상태 (입금확인 · 결제완료 · 확정) */
export function isConfirmed(status: string): boolean {
  const s = (status ?? "").trim();
  return s === "입금확인" || s === "결제완료" || s === "확정";
}

/** 입금대기로 볼 상태 (빈값 · 신청) */
export function isPending(status: string): boolean {
  const s = (status ?? "").trim();
  return s === "" || s === "신청";
}

/** 신청일시로부터 며칠 지났는지(달력 일수). 파싱 실패 시 0. */
export function ageDays(createdAt: string, now: Date = kstNow()): number {
  const d = parseSheetDateTime(createdAt);
  if (!d) return 0;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export type Digest = {
  today: string;
  /** 살롱+스테이 입금대기, 신청일시 오름차순(오래된 순) */
  pending: string[][];
  /** 오늘 체크인 (스테이, 취소 제외) */
  checkIns: string[][];
  /** 오늘 체크아웃 (스테이, 취소 제외) */
  checkOuts: string[][];
  /** 오늘 살롱 (취소 제외) */
  salonToday: string[][];
  /** 어제 신규 신청 (취소 제외) */
  newYesterday: string[][];
  /** 이번 달 신청분 중 확정 건수·금액 */
  month: { confirmedCount: number; confirmedAmount: number };
  /** 회차별 신청 인원 (취소 제외) */
  retreatCounts: Record<string, number>;
};

/**
 * 헤더 행이 포함된 배열을 받아 내부에서 slice(1)한다.
 * now를 주면 그 시각 기준(테스트용), 안 주면 현재 KST.
 */
export function buildDigest(
  bookings: string[][],
  retreats: string[][],
  now: Date = kstNow()
): Digest {
  const rows = bookings.slice(1);
  const retreatRows = retreats.slice(1);

  const today = toISODate(now);
  const yesterday = toISODate(addDays(now, -1));

  const alive = (r: string[]) => (r[13] ?? "").trim() !== CANCELLED;
  const isStay = (r: string[]) => r[1] === "스테이";
  const isSalon = (r: string[]) => r[1] === "살롱";

  const pending = rows
    .filter((r) => isPending(r[13] ?? ""))
    .sort((a, b) => {
      // 신청일시를 못 읽는 행(시트 수기 입력)은 오래된 순 정렬에서 맨 뒤로 보낸다.
      const da = parseSheetDateTime(a[0])?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = parseSheetDateTime(b[0])?.getTime() ?? Number.POSITIVE_INFINITY;
      return da === db ? 0 : da - db;
    });

  const checkIns = rows.filter((r) => isStay(r) && normalizeDate(r[8]) === today && alive(r));
  const checkOuts = rows.filter((r) => isStay(r) && normalizeDate(r[9]) === today && alive(r));
  const salonToday = rows.filter(
    (r) => isSalon(r) && programDateISO(r[5], now) === today && alive(r)
  );
  const newYesterday = rows.filter((r) => createdISO(r[0]) === yesterday && alive(r));

  const monthPrefix = today.slice(0, 7);
  let confirmedCount = 0;
  let confirmedAmount = 0;
  for (const r of rows) {
    if (!createdISO(r[0]).startsWith(monthPrefix)) continue;
    if (!isConfirmed(r[13] ?? "")) continue;
    confirmedCount++;
    confirmedAmount += parseAmount(r[11]);
  }

  const retreatCounts: Record<string, number> = {};
  for (const s of RETREAT_SESSIONS) retreatCounts[s.key] = 0;
  for (const r of retreatRows) {
    if ((r[12] ?? "").trim() === CANCELLED) continue;
    for (const s of RETREAT_SESSIONS) {
      if (r[5]?.includes(s.label.split(" ")[0])) retreatCounts[s.key]++;
    }
  }

  return {
    today,
    pending,
    checkIns,
    checkOuts,
    salonToday,
    newYesterday,
    month: { confirmedCount, confirmedAmount },
    retreatCounts,
  };
}

/** 지금 시각을 "KST 벽시계를 로컬 필드에 담은 Date"로. */
export function kstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

/* ─── 내부 헬퍼 ───────────────────────────── */

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function addDays(d: Date, days: number): Date {
  const c = new Date(d.getTime());
  c.setDate(c.getDate() + days);
  return c;
}

/** 신청일시(A열) → "YYYY-MM-DD". 파싱 실패 시 빈 문자열. */
function createdISO(s: string): string {
  const d = parseSheetDateTime(s);
  return d ? toISODate(d) : "";
}

/**
 * 살롱 일시(F열)에서 날짜를 뽑는다.
 * 시트에는 연도 없는 라벨("9월 12일 (토) 20:00")이 들어가므로 now의 연도를 붙인다.
 */
function programDateISO(s: string, now: Date): string {
  if (!s) return "";
  const normalized = normalizeDate(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const m = s.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (m) {
    return `${now.getFullYear()}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return "";
}

function parseAmount(s: string): number {
  return parseInt((s ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
}
