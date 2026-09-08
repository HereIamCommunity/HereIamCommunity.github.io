import { isConfirmed, isPending, normalizeDate, parseSheetDateTime } from "@/lib/digest";
import type { RowRef } from "@/lib/row-ref";

/** 시트 한 행 (예약 A~O · 리트릿 A~M · 무료개방 A~L) */
export type Row = string[];

/** 시트 행 식별자 (6.1 계약) — `/api/admin/bookings`의 meta·retreatMeta·openMeta 원소 */
export type { RowRef };

/** 상태를 바꿀 수 있는 시트 종류 (`POST /api/admin/status`의 sheet 파라미터) */
export type SheetKind = "booking" | "retreat" | "open";
export type StatusAction = "confirm" | "cancel" | "reopen";

/** 목록·오늘·리트릿·무료개방 탭이 공유하는 행 액션 묶음 */
export type AdminActions = {
  busyKey: string | null;
  /** 마지막으로 실패한 행 — 2초 동안 테두리로 강조한다 (결과 문구는 토스트가 맡는다) */
  errorKey: string | null;
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

/* ── 시트 행 번호 레지스트리 (6.1 계약) ──────────────────────
   행은 화면 전체에서 `string[]` 그대로 흘러다니고 digest·필터·정렬이 같은 배열 참조를
   유지한다. ref를 프롭으로 나르면 컴포넌트 8곳의 시그니처가 전부 바뀌므로,
   행 배열의 정체성에 WeakMap으로 붙여 둔다. 등록은 데이터를 받은 쪽(page/preview)이 한 번만 한다. */
const REF_BY_ROW = new WeakMap<Row, RowRef>();

/**
 * `meta`를 원본 행 배열(헤더 포함)에 붙인다.
 * meta가 헤더를 포함하든(length === rawRows.length) 빼든(length === rawRows.length - 1)
 * 같은 결과가 나오도록 오프셋을 길이로 판별한다.
 */
export function registerRowRefs(rawRows: Row[], meta: RowRef[] | undefined): void {
  if (!meta || meta.length === 0) return;
  const offset = meta.length === rawRows.length ? 1 : 0;
  for (let i = 1; i < rawRows.length; i++) {
    const m = meta[i - 1 + offset];
    if (m && typeof m.rowNum === "number") REF_BY_ROW.set(rawRows[i], { tab: m.tab, rowNum: m.rowNum });
  }
}

/** 등록된 시트 행 번호. 없으면 undefined (API가 meta를 아직 안 주는 경우) */
export function rowRef(row: Row): RowRef | undefined {
  return REF_BY_ROW.get(row);
}

/**
 * 행 식별 키.
 * ref가 있으면 시트 행 번호로 만든다 — 연락처·신청일시가 둘 다 빈 행이 여럿이면
 * 예전 키(신청일시|연락처)가 충돌해 엉뚱한 행이 같이 강조되던 문제가 있었다.
 */
export function rowKey(sheet: SheetKind, row: Row): string {
  const ref = REF_BY_ROW.get(row);
  if (ref) return `${sheet}:${ref.tab}#${ref.rowNum}`;
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

/** 신청일 — "M/D HH:mm". 못 읽거나 비었으면 "—" (시트에 손으로 넣은 행) */
export function createdShort(raw: string | undefined): string {
  const d = parseSheetDateTime(raw ?? "");
  if (!d) return "—";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 신청일시의 정렬용 값. 못 읽으면 null → 항상 맨 아래로 보낸다. */
export function createdTime(raw: string | undefined): number | null {
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

/** 목록 탭 필터 — 탭을 왕복해도 유지되도록 AdminShell이 들고 있는다 */
export type ListFilters = {
  period: Period;
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  searchInput: string;
};

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

/** 상태 칩 필터와 시트 상태값을 맞춘다 */
export function matchStatusFilter(status: string, filter: StatusFilter): boolean {
  if (filter === "전체") return true;
  if (filter === "취소") return status === "취소";
  if (filter === "확정") return isConfirmed(status);
  return isPending(status) || !status;
}

/**
 * 목록 탭의 필터 + 검색 + 정렬. 전역 검색창의 "N건"과 목록이 항상 같은 결과를 쓰도록
 * AdminShell(건수)과 ListTab(목록)이 이 함수 하나를 공유한다.
 */
export function filterBookings(rows: Row[], filters: ListFilters, todayISO: string): Row[] {
  const q = filters.searchInput.trim();
  return rows
    .filter((row) => {
      if (filters.typeFilter !== "전체" && row[1] !== filters.typeFilter) return false;
      if (!matchStatusFilter(bookingStatus(row), filters.statusFilter)) return false;
      if (!inPeriod(row[0], filters.period, todayISO)) return false;
      if (!q) return true;
      return [row[2], row[3], row[4], row[6]].some((c) => (c ?? "").includes(q));
    })
    .sort(byCreatedDesc);
}

/* ── 버튼 클래스 (높이 2종만: 44px / 36px · 라벨은 항상 한 줄) ── */
export const BTN_BASE =
  "inline-flex items-center justify-center h-11 px-4 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
export const BTN_PRIMARY = `${BTN_BASE} bg-brown text-white hover:bg-brown/85`;
export const BTN_CONFIRM = `${BTN_BASE} bg-teal text-white hover:bg-teal-dark`;
export const BTN_OUTLINE = `${BTN_BASE} border border-gray-300 text-gray-700 hover:border-brown hover:text-brown bg-white`;
export const BTN_DANGER = `${BTN_BASE} border border-orange-dark bg-orange/10 text-brown hover:bg-orange/20`;
/** 표·카드 안의 작은 버튼 — 칩과 같은 36px */
export const BTN_SMALL =
  "inline-flex items-center justify-center h-9 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-40 border bg-white";
/** 입력 요소도 버튼과 같은 44px */
export const FIELD =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-brown placeholder:text-gray-500";

/* ── 카드·간격·타이포 (박스 크기 통일) ────────────────────
   흰 카드 표면은 이 3종만 쓴다. 새 카드를 만들 땐 여기서 골라 쓰고
   패딩·라운드·테두리를 따로 적지 않는다. */
/** 기본 카드 — 안쪽 콘텐츠가 패딩을 갖지 않는 경우 */
export const CARD = "rounded-xl border border-gray-200 bg-white p-4 md:p-5";
/** 표·행 리스트처럼 자식이 자기 패딩을 갖는 카드 (바깥 패딩 없음) */
export const CARD_FLUSH = "rounded-xl border border-gray-200 bg-white";
/** 빈 상태 카드 */
export const CARD_EMPTY =
  "rounded-xl border border-dashed border-gray-300 bg-white p-6 md:p-8 text-center";
/** 같은 줄 카드의 높이를 맞춘다 (그리드는 CARD_GRID, 카드는 이 클래스) */
export const CARD_STACK = "flex h-full flex-col";
/** 카드 그리드 — 열 수는 쓰는 쪽에서 붙인다 */
export const CARD_GRID = "grid items-stretch gap-3 md:gap-4";

/** 카드의 큰 숫자 — 넘치면 줄바꿈 대신 말줄임 */
export const STAT_VALUE =
  "overflow-hidden text-ellipsis whitespace-nowrap text-2xl md:text-3xl font-light tabular-nums";
/** 카드의 작은 라벨 (항상 값보다 위) */
export const STAT_LABEL = "whitespace-nowrap text-xs tracking-wide text-gray-500";
/** 섹션 제목 / 그 오른쪽의 건수 */
export const SECTION_H = "whitespace-nowrap text-sm font-medium text-brown";
export const SECTION_COUNT = "whitespace-nowrap text-xs text-gray-500";

/** 표 헤더·셀 패딩 (BookingList · EntryList · BucketTable 공통) */
export const TH_CELL = "whitespace-nowrap px-4 py-3 text-xs font-medium text-gray-700";
export const TD_CELL = "whitespace-nowrap px-4 py-3";

/* ── 리스트형 목록 (6.3) ─────────────────────────────
   카드 테두리·라운드 없이 구분선만. md 미만 행과 md 이상 표가 같은 톤을 쓴다. */
/** md 미만 리스트 행 */
export const LIST_ROW = "relative border-b border-gray-100 px-4 py-3 last:border-0";
/** 처리 중 — 행 전체를 흐리게 */
export const ROW_BUSY = "opacity-60";
/** 방금 실패한 행 — 2초 강조 (색만으로 알리지 않도록 토스트가 같은 내용을 말한다).
    가로 고정 셀은 자기 배경을 갖고 있어 행 배경을 덮으므로 CELL_BG로 같이 맞춰준다. */
export const ROW_FAILED = "outline-2 -outline-offset-2 outline-orange-dark bg-orange/10";
/** 고정 셀 배경 — 실패 강조 중에는 행과 같은 색이어야 강조가 끊겨 보이지 않는다 */
export const cellBg = (failed: boolean) => (failed ? "bg-orange/10" : "bg-white");
/** 표 안에서 가로로 고정되는 셀 (이름 = left, 처리 = right) */
export const STICKY_L = "sticky left-0 z-10";
export const STICKY_R = "sticky right-0 z-10";

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
