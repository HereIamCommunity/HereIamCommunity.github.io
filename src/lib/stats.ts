/**
 * 어드민 통계 탭 집계 (순수 함수).
 *
 * 시트 I/O·네트워크 없음 — `/api/admin/bookings`의 `rows`를 그대로 넣는다.
 * 버킷은 전부 **신청일시(A열)** 기준이다. 체크인 날짜가 아니라 "언제 신청이 들어왔나".
 *
 * 집계 기준
 *   확정   = isConfirmed(N열) — 입금확인 · 결제완료
 *   제외   = 취소
 *   신청   = 취소를 뺀 전체 (requested) — 확정과 별개로 센다
 * 신청일시를 못 읽는 행은 어느 집계에도 넣지 않는다(버킷을 정할 수 없다).
 *
 * 예약 행(A~O): 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수
 *               8체크인 9체크아웃 10할인 11결제금액 12요청사항 13상태 14알림
 */

import { isConfirmed, kstNow, parseSheetDateTime } from "@/lib/digest";
import { discountKey } from "@/lib/admin-row";

const CANCELLED = "취소";
const DAILY_DAYS = 30;
const MONTHLY_MONTHS = 12;
const PROGRAM_LIMIT = 10;

export type Bucket = {
  key: string;
  label: string;
  salonCount: number;
  stayCount: number;
  salonAmount: number;
  stayAmount: number;
  requested: number;
};

export type Comparison = {
  label: string;
  current: number;
  previous: number;
  diff: number;
  /** 증감률(%). 이전 값이 0이면 계산할 수 없어 null. 소수 첫째 자리 반올림. */
  pct: number | null;
  unit: "건" | "원";
};

export type Stats = {
  /** 최근 30일, 빈 날도 0, 오래된 → 최신 */
  daily: Bucket[];
  /** 최근 12개월, 빈 달도 0, 오래된 → 최신 */
  monthly: Bucket[];
  /** 데이터가 있는 연도 전부, 오름차순 */
  yearly: Bucket[];
  compare: {
    monthCount: Comparison;
    monthAmount: Comparison;
    yearCount: Comparison;
    yearAmount: Comparison;
    yoyMonthCount: Comparison;
    yoyMonthAmount: Comparison;
  };
  /** 살롱 확정, 건수 내림차순 상위 10 */
  byProgram: { name: string; count: number; amount: number }[];
  /** 스테이 확정, 박수 내림차순 */
  byRoom: { room: string; nights: number; count: number; amount: number }[];
  /** 확정 건의 할인 종류별 건수 */
  discount: { none: number; geot: number; nagnae: number };
  basis: { confirmedStatuses: string[]; excludes: string[] };
};

type ParsedRow = {
  dayKey: string;   // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  yearKey: string;  // YYYY
  isSalon: boolean;
  program: string;
  room: string;
  nights: number;
  amount: number;
  confirmed: boolean;
  discount: "none" | "geot" | "nagnae";
};

/** 헤더 행이 포함된 배열을 받아 내부에서 slice(1)한다. now를 주면 그 시각 기준. */
export function buildStats(bookings: string[][], now: Date = kstNow()): Stats {
  const rows = parseRows(bookings.slice(1));

  const daily = fillBuckets(recentDayKeys(now), rows, (r) => r.dayKey, dayLabels);
  const monthly = fillBuckets(recentMonthKeys(now), rows, (r) => r.monthKey, monthLabels);
  const yearly = fillBuckets(presentYearKeys(rows), rows, (r) => r.yearKey, yearLabels);

  const thisMonth = monthKeyOf(now);
  const lastMonth = monthKeyOf(addMonths(now, -1));
  const yoyMonth = monthKeyOf(addMonths(now, -12));
  const thisYear = String(now.getFullYear());
  const lastYear = String(now.getFullYear() - 1);

  const inMonth = (key: string) => (r: ParsedRow) => r.monthKey === key;
  const inYear = (key: string) => (r: ParsedRow) => r.yearKey === key;

  const compare = {
    monthCount: comparison("이번 달 vs 지난 달", "건", count(rows, inMonth(thisMonth)), count(rows, inMonth(lastMonth))),
    monthAmount: comparison("이번 달 vs 지난 달", "원", amount(rows, inMonth(thisMonth)), amount(rows, inMonth(lastMonth))),
    yearCount: comparison("올해 vs 작년", "건", count(rows, inYear(thisYear)), count(rows, inYear(lastYear))),
    yearAmount: comparison("올해 vs 작년", "원", amount(rows, inYear(thisYear)), amount(rows, inYear(lastYear))),
    yoyMonthCount: comparison("전년 동월 대비", "건", count(rows, inMonth(thisMonth)), count(rows, inMonth(yoyMonth))),
    yoyMonthAmount: comparison("전년 동월 대비", "원", amount(rows, inMonth(thisMonth)), amount(rows, inMonth(yoyMonth))),
  };

  return {
    daily,
    monthly,
    yearly,
    compare,
    byProgram: byProgram(rows),
    byRoom: byRoom(rows),
    discount: discountBreakdown(rows),
    basis: { confirmedStatuses: ["입금확인", "결제완료"], excludes: [CANCELLED] },
  };
}

/* ─── 행 파싱 ─────────────────────────────── */

function parseRows(rows: string[][]): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  for (const r of rows) {
    if ((r[13] ?? "").trim() === CANCELLED) continue;
    const date = parseSheetDateTime(r[0]);
    if (!date) continue;

    parsed.push({
      dayKey: dayKeyOf(date),
      monthKey: monthKeyOf(date),
      yearKey: String(date.getFullYear()),
      isSalon: r[1] === "살롱",
      program: (r[4] ?? "").trim(),
      room: (r[6] ?? "").trim(),
      nights: toNumber(r[7]),
      amount: toNumber(r[11]),
      confirmed: isConfirmed(r[13] ?? ""),
      discount: discountKey(r[10] ?? ""),
    });
  }
  return parsed;
}

/* ─── 버킷 ───────────────────────────────── */

function fillBuckets(
  keys: string[],
  rows: ParsedRow[],
  keyOf: (r: ParsedRow) => string,
  labelsOf: (keys: string[]) => string[]
): Bucket[] {
  const index = new Map<string, Bucket>();
  const buckets = keys.map((key) => {
    const b: Bucket = {
      key,
      label: key,
      salonCount: 0,
      stayCount: 0,
      salonAmount: 0,
      stayAmount: 0,
      requested: 0,
    };
    index.set(key, b);
    return b;
  });

  for (const r of rows) {
    const b = index.get(keyOf(r));
    if (!b) continue;
    b.requested++;
    if (!r.confirmed) continue;
    if (r.isSalon) {
      b.salonCount++;
      b.salonAmount += r.amount;
    } else {
      b.stayCount++;
      b.stayAmount += r.amount;
    }
  }

  // 월 라벨은 앞 칸의 연도를 봐야 정해져서 시퀀스 전체를 넘긴다.
  labelsOf(keys).forEach((text, i) => {
    buckets[i].label = text;
  });

  return buckets;
}

/** 오늘까지의 최근 30일 (오래된 → 최신) */
function recentDayKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let i = DAILY_DAYS - 1; i >= 0; i--) {
    keys.push(dayKeyOf(addDays(now, -i)));
  }
  return keys;
}

/** 이번 달까지의 최근 12개월 (오래된 → 최신) */
function recentMonthKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let i = MONTHLY_MONTHS - 1; i >= 0; i--) {
    keys.push(monthKeyOf(addMonths(now, -i)));
  }
  return keys;
}

/** 데이터가 있는 연도만 오름차순 */
function presentYearKeys(rows: ParsedRow[]): string[] {
  return [...new Set(rows.map((r) => r.yearKey))].sort();
}

/* ─── 라벨 ───────────────────────────────── */

/** "2026-09-07" → "9/7" */
function dayLabels(keys: string[]): string[] {
  return keys.map((key) => {
    const [, m, d] = key.split("-");
    return `${Number(m)}/${Number(d)}`;
  });
}

/** "2026" → "2026년" */
function yearLabels(keys: string[]): string[] {
  return keys.map((key) => `${key}년`);
}

/** "9월". 첫 칸이거나 앞 칸과 연도가 다르면 "2026년 1월". */
function monthLabels(keys: string[]): string[] {
  return keys.map((key, i) => {
    const [y, m] = key.split("-");
    const prevYear = i > 0 ? keys[i - 1].split("-")[0] : null;
    return prevYear === y ? `${Number(m)}월` : `${y}년 ${Number(m)}월`;
  });
}

/* ─── 비교 ───────────────────────────────── */

function comparison(
  label: string,
  unit: "건" | "원",
  current: number,
  previous: number
): Comparison {
  const diff = current - previous;
  const pct = previous === 0 ? null : Math.round((diff / previous) * 1000) / 10;
  return { label, current, previous, diff, pct, unit };
}

function count(rows: ParsedRow[], within: (r: ParsedRow) => boolean): number {
  return rows.filter((r) => r.confirmed && within(r)).length;
}

function amount(rows: ParsedRow[], within: (r: ParsedRow) => boolean): number {
  return rows.reduce((sum, r) => (r.confirmed && within(r) ? sum + r.amount : sum), 0);
}

/* ─── 분석 ───────────────────────────────── */

function byProgram(rows: ParsedRow[]) {
  const map = new Map<string, { name: string; count: number; amount: number }>();
  for (const r of rows) {
    if (!r.confirmed || !r.isSalon || !r.program) continue;
    const hit = map.get(r.program) ?? { name: r.program, count: 0, amount: 0 };
    hit.count++;
    hit.amount += r.amount;
    map.set(r.program, hit);
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.amount - a.amount || a.name.localeCompare(b.name))
    .slice(0, PROGRAM_LIMIT);
}

function byRoom(rows: ParsedRow[]) {
  const map = new Map<string, { room: string; nights: number; count: number; amount: number }>();
  for (const r of rows) {
    if (!r.confirmed || r.isSalon || !r.room) continue;
    const hit = map.get(r.room) ?? { room: r.room, nights: 0, count: 0, amount: 0 };
    hit.nights += r.nights;
    hit.count++;
    hit.amount += r.amount;
    map.set(r.room, hit);
  }
  return [...map.values()].sort(
    (a, b) => b.nights - a.nights || b.count - a.count || a.room.localeCompare(b.room)
  );
}

function discountBreakdown(rows: ParsedRow[]) {
  const out = { none: 0, geot: 0, nagnae: 0 };
  for (const r of rows) {
    if (!r.confirmed) continue;
    out[r.discount]++;
  }
  return out;
}

/* ─── 날짜 유틸 ───────────────────────────── */

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function addDays(d: Date, days: number): Date {
  const c = new Date(d.getTime());
  c.setDate(c.getDate() + days);
  return c;
}

/** 말일 넘침을 막기 위해 1일로 맞춘 뒤 옮긴다 (8/31 - 1개월 = 7/31 → 7월). */
function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toNumber(s: string): number {
  return parseInt((s ?? "").replace(/[^0-9]/g, ""), 10) || 0;
}
