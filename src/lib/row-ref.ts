/**
 * 시트 행을 "탭 + 행 번호"로 가리키는 참조(ref) — 순수 로직.
 *
 * 배경: 연락처·신청일시가 빈 행(시트에 손으로 넣은 건)은 연락처로 찾을 수 없다.
 * 어드민 목록이 각 행의 시트 행 번호(meta)를 함께 받아 두고,
 * 상태 변경·재발송 때 그 번호를 그대로 돌려주면 탐색 없이 정확한 행을 읽고 쓴다.
 *
 * 시트 I/O·네트워크 없음 (sheets.ts가 이 모듈을 쓴다).
 */

export type SheetTab = "살롱" | "스테이" | "리트릿" | "무료개방";

/** 시트 행 참조. rowNum은 1-based 시트 행 번호(헤더가 1행). */
export type RowRef = { tab: SheetTab; rowNum: number };

/** 어드민 목록 응답의 meta 원소 — ref와 같은 모양이다. */
export type RowMeta = RowRef;

/** 탭별 마지막 열 (읽기 범위 A~?) */
const TAB_LAST_COL: Record<SheetTab, string> = {
  살롱: "O",
  스테이: "O",
  리트릿: "M",
  무료개방: "L",
};

/** 예약 탭(살롱·스테이) 기본 헤더 — 두 탭이 모두 비었을 때 쓴다. */
export const BOOKING_HEADER = [
  "신청일시","구분","이름","연락처","프로그램","일시","객실","박수","체크인","체크아웃","할인","결제금액","요청사항","상태","알림",
];

export function isSheetTab(v: unknown): v is SheetTab {
  return v === "살롱" || v === "스테이" || v === "리트릿" || v === "무료개방";
}

/**
 * 요청 body의 ref를 검증한다. 모르는 탭·헤더 행(1)·정수가 아닌 번호는 null.
 * null이면 호출부는 기존 탐색(연락처 매칭) 경로를 쓴다.
 */
export function normalizeRowRef(v: unknown): RowRef | null {
  if (!v || typeof v !== "object") return null;
  const { tab, rowNum } = v as { tab?: unknown; rowNum?: unknown };
  if (!isSheetTab(tab)) return null;
  if (typeof rowNum !== "number" || !Number.isInteger(rowNum) || rowNum < 2) return null;
  return { tab, rowNum };
}

/** ref가 가리키는 한 줄의 A1 범위 — "스테이!A12:O12" */
export function refRowRange(ref: RowRef): string {
  const last = TAB_LAST_COL[ref.tab];
  return `${ref.tab}!A${ref.rowNum}:${last}${ref.rowNum}`;
}

/** ref가 가리키는 한 칸의 A1 범위 — "스테이!N12" */
export function refCellRange(ref: RowRef, col: string): string {
  return `${ref.tab}!${col}${ref.rowNum}`;
}

/** 한 탭의 행 배열에 meta를 붙인다. 시트 행 번호는 인덱스 + 1. */
export function attachRowMeta(rows: string[][], tab: SheetTab): RowMeta[] {
  return rows.map((_, i) => ({ tab, rowNum: i + 1 }));
}

/**
 * 살롱 + 스테이를 합치면서 각 행의 출처 탭·시트 행 번호를 같이 만든다.
 * rows는 기존 getAllBookings와 동일(헤더 1줄 + 살롱 데이터 + 스테이 데이터)하고,
 * meta는 rows와 **길이·순서가 같다**(meta[0]은 헤더 행).
 */
export function mergeBookingRowsWithMeta(
  salonRows: string[][],
  stayRows: string[][]
): { rows: string[][]; meta: RowMeta[] } {
  const header = salonRows[0] ?? stayRows[0] ?? BOOKING_HEADER;
  const headerTab: SheetTab = salonRows[0] ? "살롱" : stayRows[0] ? "스테이" : "살롱";

  const rows: string[][] = [header];
  const meta: RowMeta[] = [{ tab: headerTab, rowNum: 1 }];

  for (let i = 1; i < salonRows.length; i++) {
    rows.push(salonRows[i]);
    meta.push({ tab: "살롱", rowNum: i + 1 });
  }
  for (let i = 1; i < stayRows.length; i++) {
    rows.push(stayRows[i]);
    meta.push({ tab: "스테이", rowNum: i + 1 });
  }

  return { rows, meta };
}
