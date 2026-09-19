/**
 * 신청 행 참조(ref) — "탭 + DB id". 순수 로직.
 *
 * 배경: 연락처·신청일시가 빈 행(손으로 넣은 건)은 연락처로 찾을 수 없다.
 * 어드민 목록이 각 행의 ref(meta)를 함께 받아 두고, 상태 변경·재발송 때
 * 그 ref를 그대로 돌려주면 탐색 없이 정확한 행을 읽고 쓴다.
 *
 * 2026-09-19 Supabase 이전: 시트 행 번호(rowNum) 대신 DB 기본키(id)를 쓴다.
 * 살롱·스테이는 같은 `bookings` 테이블이라 id가 두 탭에 걸쳐 유일하다.
 * `SheetTab`이라는 이름은 화면·API 계약에 남아 있어 그대로 둔다.
 */

export type SheetTab = "살롱" | "스테이" | "리트릿" | "무료개방";

/** 행 참조. id는 DB 기본키(1 이상). 목록 meta의 헤더 자리에는 id 0이 온다. */
export type RowRef = { tab: SheetTab; id: number };

/** 어드민 목록 응답의 meta 원소 — ref와 같은 모양이다. */
export type RowMeta = RowRef;

/** 예약 한 건의 상태·알림 칸 변경. 키가 없는 칸은 그대로 둔다. */
export type BookingPatch = { ref: RowRef; status?: string; notify?: string };

/** 예약 목록(살롱·스테이) 헤더 — 화면이 열 순서를 이 배열로 안다. */
export const BOOKING_HEADER = [
  "신청일시","구분","이름","연락처","프로그램","일시","객실","박수","체크인","체크아웃","할인","결제금액","요청사항","상태","알림",
];

export function isSheetTab(v: unknown): v is SheetTab {
  return v === "살롱" || v === "스테이" || v === "리트릿" || v === "무료개방";
}

/** 예약 테이블(bookings)에 있는 탭인지 */
export function isBookingTab(tab: SheetTab): tab is "살롱" | "스테이" {
  return tab === "살롱" || tab === "스테이";
}

/**
 * 요청 body의 ref를 검증한다. 모르는 탭·헤더 자리(0)·정수가 아닌 id는 null.
 * null이면 호출부는 기존 탐색(연락처 매칭) 경로를 쓴다.
 */
export function normalizeRowRef(v: unknown): RowRef | null {
  if (!v || typeof v !== "object") return null;
  const { tab, id } = v as { tab?: unknown; id?: unknown };
  if (!isSheetTab(tab)) return null;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) return null;
  return { tab, id };
}
