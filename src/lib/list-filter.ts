/**
 * 목록 탭 필터 — 화면과 서버가 **같은 함수**로 대상을 고른다.
 *
 * 배경(2026-09-11 운영 요청): 운영자가 목록에서 날짜 범위로 걸러 본 뒤 "보이는 그 건들"을
 * 그대로 일괄 처리한다. 목록 건수와 일괄 처리 대상이 어긋나면 사고가 나므로,
 * `ListTab`(목록)·`AdminShell`(검색 N건)·`/api/admin/bulk`(대상 선정)가 이 파일 하나를 쓴다.
 *
 * ⚠ **브라우저 안전**: 이 모듈은 클라이언트 번들에 들어간다. `node:*`·googleapis·solapi 등
 * 노드 전용 모듈을 직접·간접으로 import하면 안 된다.
 * (허용 의존: `digest.ts` → `retreat-sessions.ts`, `past-booking.ts` → `digest.ts` — 모두 순수)
 *
 * 예약 행(A~O): 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수
 *               8체크인 9체크아웃 10할인 11결제금액 12요청사항 13상태 14알림
 */

import { isConfirmed, isPending, parseSheetDateTime } from "@/lib/digest";
import { usageDateISO } from "@/lib/past-booking";

/** 시트 한 행 (예약 A~O) */
type Row = string[];

export type Period = "오늘" | "이번 주" | "이번 달" | "전체" | "기간설정";
export type TypeFilter = "전체" | "살롱" | "스테이";
export type StatusFilter = "전체" | "입금대기" | "확정" | "취소";

/** 기간설정 칩의 날짜 범위. 양끝 포함, 한쪽만 줘도 된다(열린 구간). */
export type ListRange = {
  /** 사용일(스테이=체크인·살롱=일시) 또는 신청일(A열) */
  basis: "usage" | "created";
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
};

/** 목록 탭 필터 — 탭을 왕복해도 유지되도록 AdminShell이 들고 있는다 */
export type ListFilters = {
  period: Period;
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  searchInput: string;
  /** `period === "기간설정"`일 때만 쓴다 */
  range?: ListRange;
};

/** 예약 행의 상태(N열). 빈값은 "신청"으로 본다. */
export function bookingStatus(row: Row): string {
  return (row[13] ?? "").trim() || "신청";
}

/** Date → "YYYY-MM-DD" (parseSheetDateTime이 이미 KST로 맞춰 돌려준다) */
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 신청일시 기준 기간 필터.
 * `기간설정`은 날짜 범위를 따로 보므로 여기서는 통과시킨다(`filterBookings`가 range를 적용).
 */
export function inPeriod(createdAt: string, period: Period, todayISO: string): boolean {
  if (period === "전체" || period === "기간설정") return true;
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

/** 상태 칩 필터와 시트 상태값을 맞춘다 */
export function matchStatusFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "전체") return true;
  if (filter === "취소") return status === "취소";
  if (filter === "확정") return isConfirmed(status);
  return isPending(status) || !status;
}

/** 신청일시의 정렬용 값. 못 읽으면 null → 항상 맨 아래로 보낸다. */
function createdTime(raw: string | undefined): number | null {
  return parseSheetDateTime(raw ?? "")?.getTime() ?? null;
}

/** 신청일 내림차순. 신청일시를 못 읽는 행은 순서와 상관없이 맨 아래. */
export function byCreatedDesc(a: Row, b: Row): number {
  const ta = createdTime(a[0]);
  const tb = createdTime(b[0]);
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return tb - ta;
}

/**
 * 기간설정 기준 날짜 ISO. 못 읽으면 "" — 범위 조건에서 **제외**된다.
 * 날짜를 모르는 행을 범위로 쓸어 담는 사고를 막는다(`selectBulkTargets`와 같은 규칙).
 */
export function rangeDateISO(row: Row, basis: ListRange["basis"], todayISO: string): string {
  if (basis === "created") {
    const d = parseSheetDateTime(row[0] ?? "");
    return d ? isoOf(d) : "";
  }
  // 사용일 — 살롱의 "9월 5일" 같은 연도 없는 라벨은 오늘의 연도로 읽는다.
  return usageDateISO(
    {
      type: row[1] === "살롱" ? "salon" : "stay",
      date: row[5] || undefined,
      checkIn: row[8] || undefined,
    },
    kstDateOf(todayISO)
  );
}

/** "YYYY-MM-DD" → 그 날 KST 00:00의 실제 시각(usageDateISO의 연도 보정용) */
function kstDateOf(todayISO: string): Date {
  const d = new Date(`${todayISO}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** 양끝 포함. from·to 한쪽만 있으면 열린 구간. */
function inRange(iso: string, range: ListRange): boolean {
  if (!iso) return false;                       // 날짜 불명 → 제외
  if (range.from && iso < range.from) return false;
  if (range.to && iso > range.to) return false;
  return true;
}

/**
 * 목록 탭의 필터 + 검색 + 정렬. 전역 검색창의 "N건"과 목록이 항상 같은 결과를 쓰도록
 * AdminShell(건수)·ListTab(목록)·`/api/admin/bulk`(대상 선정)가 이 함수 하나를 공유한다.
 *
 * `period === "기간설정"`이면 `filters.range`를 적용한다(양끝 포함 · 한쪽 열림 · 날짜 불명 제외).
 * range가 아예 없으면 기간으로 거르지 않는다(= 전체).
 */
export function filterBookings(rows: Row[], filters: ListFilters, todayISO: string): Row[] {
  const q = filters.searchInput.trim();
  const range = filters.period === "기간설정" ? filters.range : undefined;
  return rows
    .filter((row) => {
      if (filters.typeFilter !== "전체" && row[1] !== filters.typeFilter) return false;
      if (!matchStatusFilter(bookingStatus(row), filters.statusFilter)) return false;
      if (!inPeriod(row[0], filters.period, todayISO)) return false;
      if (range && !inRange(rangeDateISO(row, range.basis, todayISO), range)) return false;
      if (!q) return true;
      return [row[2], row[3], row[4], row[6]].some((c) => (c ?? "").includes(q));
    })
    .sort(byCreatedDesc);
}
