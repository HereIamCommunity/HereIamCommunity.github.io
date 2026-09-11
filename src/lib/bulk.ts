/**
 * 일괄 처리(bulk)의 순수 로직 — 대상 선정 · 잡 식별자 · 쓰기 계획 · 요청 파싱.
 *
 * 시트 I/O·네트워크 없음. 라우트(`/api/admin/bulk`)는 이 결과를 그대로 실행한다.
 *
 * 왜 순수하게 떼어놨나: 2026-09-10 운영에서 99건을 건별 API로 돌렸다가
 * 행마다 시트를 다시 읽어 **읽기 쿼터(429)** 에 걸렸다. 그래서 run은
 * `getAllBookingsWithMeta()` **읽기 1회** → `planBulkWrites` → `batchUpdateCells` **쓰기 1회**로 끝낸다.
 * 대상 선정과 쓰기 계획이 시트를 만지지 않아야 이 구조가 유지된다.
 *
 * 예약 행(A~O): 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수
 *               8체크인 9체크아웃 10할인 11결제금액 12요청사항 13상태 14알림
 *
 * 시각 규약: 이 파일의 `now`는 **실제 시각(instant)** 이다. `usageDateISO`·`silentStatusText`가
 * 둘 다 Intl의 `timeZone: "Asia/Seoul"`로 변환하므로 머신 TZ와 무관하다.
 * (`digest.ts`의 `kstNow()`가 주는 "KST 벽시계를 로컬 필드에 담은 Date"를 넘기면 안 된다.)
 */

import { createHash } from "node:crypto";
import { resolveStatusAction, type AdminAction } from "@/lib/admin-actions";
import { parseAdminRow } from "@/lib/admin-row";
import { isConfirmed, isPending } from "@/lib/digest";
import {
  filterBookings,
  type ListFilters,
  type ListRange,
  type Period,
  type StatusFilter,
  type TypeFilter,
} from "@/lib/list-filter";
import { silentStatusText } from "@/lib/messaging";
import { usageDateISO } from "@/lib/past-booking";
import { refCellRange, type RowMeta, type RowRef } from "@/lib/row-ref";

export type BulkStatusFilter = "pending" | "confirmed" | "cancelled" | "all";
export type BulkTypeFilter = "all" | "salon" | "stay";
export type BulkAction = AdminAction;

export type BulkFilter = {
  /** 사용일 < 이 날짜 (YYYY-MM-DD) */
  usageBefore?: string;
  /** 사용일 >= 이 날짜 (YYYY-MM-DD) — before/after를 같은 날짜로 주면 정확히 두 조각이 된다 */
  usageAfter?: string;
  status: BulkStatusFilter;
  type: BulkTypeFilter;
};

/** 일괄 처리 대상 한 건. `row`는 시트 원본 행(A~O). */
export type BulkTarget = {
  ref: RowRef;
  name: string;
  type: "salon" | "stay";
  /** 사용일 ISO(YYYY-MM-DD). 스테이=체크인, 살롱=일시. 판정 불가 행은 대상이 되지 않는다. */
  usage: string;
  /** N열 원값 */
  status: string;
  /** O열 원값 */
  notify: string;
  row: string[];
};

/** 되돌리기용 스냅샷 한 건 — 쓰기 직전의 N·O 원값. */
export type BulkSnapshotItem = { ref: RowRef; status: string; notify: string };

export type BulkPlan = {
  /** values.batchUpdate에 그대로 넘길 data */
  writes: { range: string; values: string[][] }[];
  snapshot: BulkSnapshotItem[];
  applied: RowRef[];
  skipped: { ref: RowRef; name: string; reason: string }[];
};

const CANCELLED = "취소";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ─── 대상 선정 ────────────────────────────────── */

function matchesStatus(status: string, want: BulkStatusFilter): boolean {
  const s = (status ?? "").trim();
  if (want === "all") return true;
  if (want === "pending") return isPending(s);
  if (want === "confirmed") return isConfirmed(s);
  return s === CANCELLED;
}

/**
 * 조건에 맞는 행을 고른다. `rows`는 헤더를 포함한 예약 배열(`getAllBookingsWithMeta().rows`),
 * `meta`는 그와 **길이·순서가 같은** 행 참조 배열.
 *
 * 제외 규칙:
 * - 헤더 행(meta.rowNum < 2)
 * - 살롱·스테이가 아닌 탭
 * - **사용일을 읽을 수 없는 행** — 날짜로 범위를 자르는 기능이라, 날짜를 모르는 행을
 *   쓸어 담는 사고를 막는다(조건에 날짜가 없어도 마찬가지).
 */
export function selectBulkTargets(
  rows: string[][],
  meta: RowMeta[],
  filter: BulkFilter,
  now: Date = new Date()
): BulkTarget[] {
  const out: BulkTarget[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ref = meta[i];
    if (!row || !ref) continue;
    if (ref.rowNum < 2) continue;                                  // 헤더
    if (ref.tab !== "살롱" && ref.tab !== "스테이") continue;

    const booking = parseAdminRow(row);
    const usage = usageDateISO(booking, now);
    if (!usage) continue;                                          // 사용일 불명

    if (filter.usageBefore && !(usage < filter.usageBefore)) continue;
    if (filter.usageAfter && !(usage >= filter.usageAfter)) continue;

    const status = (row[13] ?? "").trim();
    if (!matchesStatus(status, filter.status)) continue;
    if (filter.type !== "all" && booking.type !== filter.type) continue;

    out.push({
      ref,
      name: row[2] ?? "",
      type: booking.type,
      usage,
      status,
      notify: row[14] ?? "",
      row,
    });
  }

  return out;
}

/**
 * **현재 목록 조건** 기준 대상 선정 — 화면이 보고 있는 그 행들을 그대로 고른다.
 *
 * `rows`·`meta`는 `selectBulkTargets`와 같은 배열(헤더 포함·길이 동일).
 * 목록 계산은 화면과 같은 `filterBookings`가 하고, 여기서는 정렬된 결과에 ref를 붙인다
 * (헤더를 뺀 `rows.slice(1)`의 i는 `meta[i + 1]`에 대응 — 배열 참조로 이어 붙여 정렬 후에도 맞춘다).
 *
 * `selectBulkTargets`와 달리 **사용일 불명 행을 버리지 않는다**: 목록에 보이는 건수와
 * 일괄 처리 대상 건수가 어긋나면 운영자가 잘못된 대상을 실행하게 된다.
 * 날짜로 쓸어 담는 위험은 여기선 없다 — 대상이 화면에 그대로 보이기 때문이다.
 */
export function selectBulkTargetsFromList(
  rows: string[][],
  meta: RowMeta[],
  filters: ListFilters,
  todayISO: string,
  now: Date = new Date()
): BulkTarget[] {
  const refByRow = new Map<string[], RowMeta>();
  for (let i = 1; i < rows.length; i++) {
    const ref = meta[i];
    if (rows[i] && ref) refByRow.set(rows[i], ref);
  }

  const out: BulkTarget[] = [];
  for (const row of filterBookings(rows.slice(1), filters, todayISO)) {
    const ref = refByRow.get(row);
    if (!ref) continue;
    if (ref.rowNum < 2) continue;                                  // 헤더
    if (ref.tab !== "살롱" && ref.tab !== "스테이") continue;

    const booking = parseAdminRow(row);
    out.push({
      ref,
      name: row[2] ?? "",
      type: booking.type,
      usage: usageDateISO(booking, now),                           // 불명이면 "" (제외하지 않는다)
      status: (row[13] ?? "").trim(),
      notify: row[14] ?? "",
      row,
    });
  }

  return out;
}

/* ─── 잡 식별자 ────────────────────────────────── */

/**
 * 대상 ref 목록의 해시(sha256 앞 12자). 서버는 무상태 —
 * run에서 다시 계산해 preview가 준 jobId와 다르면 409로 막는다.
 * 순서가 달라도 같은 값이 나오도록 정렬 후 해시한다.
 */
export function bulkJobId(refs: RowRef[]): string {
  const key = refs
    .map((r) => `${r.tab}#${r.rowNum}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

/* ─── 쓰기 계획 ────────────────────────────────── */

/**
 * 대상마다 `resolveStatusAction`으로 허용 여부를 판정해 적용/스킵을 나누고,
 * batchUpdate 한 번에 넘길 셀 목록을 만든다.
 *
 * - notify:false + 알림이 있는 액션(confirm·cancel) → O열에 `🔕 HH:MM … 알림 없음`
 * - notify:true → N열만. O열은 발송 후 `notifyBooking`이 남긴다.
 * - 스냅샷은 **적용된 행만**, 쓰기 전 N·O 원값 그대로(되돌리기의 원천).
 */
export function planBulkWrites(
  targets: BulkTarget[],
  action: BulkAction,
  notify: boolean,
  now: Date = new Date()
): BulkPlan {
  const plan: BulkPlan = { writes: [], snapshot: [], applied: [], skipped: [] };

  for (const t of targets) {
    const resolved = resolveStatusAction("booking", t.status, action);
    if (!resolved.ok) {
      plan.skipped.push({ ref: t.ref, name: t.name, reason: resolved.error });
      continue;
    }

    plan.writes.push({ range: refCellRange(t.ref, "N"), values: [[resolved.status]] });
    if (!notify && resolved.event) {
      plan.writes.push({
        range: refCellRange(t.ref, "O"),
        values: [[silentStatusText(resolved.event, now)]],
      });
    }

    plan.snapshot.push({ ref: t.ref, status: t.status, notify: t.notify });
    plan.applied.push(t.ref);
  }

  return plan;
}

/** 스냅샷을 그대로 되돌리는 batchUpdate data — 행마다 N·O 두 셀. */
export function planRevertWrites(
  snapshot: BulkSnapshotItem[]
): { range: string; values: string[][] }[] {
  return snapshot.flatMap((s) => [
    { range: refCellRange(s.ref, "N"), values: [[s.status]] },
    { range: refCellRange(s.ref, "O"), values: [[s.notify]] },
  ]);
}

/* ─── 요청 파싱 ────────────────────────────────── */

export type BulkRequest = {
  mode: "preview" | "run";
  /** 직접 조건 — `listFilters`와 **둘 중 하나만** */
  filter?: BulkFilter;
  /** 현재 목록 조건 — 화면이 보고 있는 필터 그대로 */
  listFilters?: ListFilters;
  action: BulkAction;
  /** 기본 false — 알림 없이 상태만 바꾸는 쪽이 안전한 기본값이다. */
  notify: boolean;
  /** run에서만 필수: preview가 준 잡 식별자 */
  jobId?: string;
};

/** 로그·요약이 다루는 조건 — 직접 조건이거나 목록 조건이거나. */
export type BulkCondition = BulkFilter | ListFilters;

/** 목록 조건인지 (직접 조건에는 period가 없다) */
export function isListCondition(c: BulkCondition): c is ListFilters {
  return !!c && typeof c === "object" && "period" in c;
}

export type BulkRequestParse =
  | { ok: true; value: BulkRequest }
  | { ok: false; error: string };

function isBulkAction(v: unknown): v is BulkAction {
  return v === "confirm" || v === "cancel" || v === "reopen";
}
function isStatusFilter(v: unknown): v is BulkStatusFilter {
  return v === "pending" || v === "confirmed" || v === "cancelled" || v === "all";
}
function isTypeFilter(v: unknown): v is BulkTypeFilter {
  return v === "all" || v === "salon" || v === "stay";
}

function isPeriod(v: unknown): v is Period {
  return v === "오늘" || v === "이번 주" || v === "이번 달" || v === "전체" || v === "기간설정";
}
function isListTypeFilter(v: unknown): v is TypeFilter {
  return v === "전체" || v === "살롱" || v === "스테이";
}
function isListStatusFilter(v: unknown): v is StatusFilter {
  return v === "전체" || v === "입금대기" || v === "확정" || v === "취소";
}

/** 목록 조건(화면이 그대로 보낸 ListFilters) 검증 — 모르는 값은 전부 400. */
function parseListFilters(v: unknown): { ok: true; value: ListFilters } | { ok: false; error: string } {
  if (!v || typeof v !== "object") return { ok: false, error: "조건이 없습니다." };
  const f = v as {
    period?: unknown; typeFilter?: unknown; statusFilter?: unknown;
    searchInput?: unknown; range?: unknown;
  };
  if (!isPeriod(f.period)) return { ok: false, error: "알 수 없는 기간 조건입니다." };
  if (!isListTypeFilter(f.typeFilter)) return { ok: false, error: "알 수 없는 구분 조건입니다." };
  if (!isListStatusFilter(f.statusFilter)) return { ok: false, error: "알 수 없는 상태 조건입니다." };
  if (f.searchInput !== undefined && typeof f.searchInput !== "string") {
    return { ok: false, error: "검색어 형식이 올바르지 않습니다." };
  }

  const value: ListFilters = {
    period: f.period,
    typeFilter: f.typeFilter,
    statusFilter: f.statusFilter,
    searchInput: typeof f.searchInput === "string" ? f.searchInput : "",
  };

  if (f.range !== undefined && f.range !== null) {
    if (typeof f.range !== "object") return { ok: false, error: "기간 형식이 올바르지 않습니다." };
    const r = f.range as { basis?: unknown; from?: unknown; to?: unknown };
    if (r.basis !== "usage" && r.basis !== "created") {
      return { ok: false, error: "기간 기준은 사용일 또는 신청일이어야 합니다." };
    }
    const range: ListRange = { basis: r.basis };
    for (const k of ["from", "to"] as const) {
      const d = r[k];
      if (d === undefined || d === null || d === "") continue;
      if (typeof d !== "string" || !ISO_DATE.test(d)) {
        return { ok: false, error: "날짜는 YYYY-MM-DD 형식이어야 합니다." };
      }
      range[k] = d;
    }
    value.range = range;
  }

  return { ok: true, value };
}

/**
 * `/api/admin/bulk` body 검증 (순수 함수). 틀리면 전부 400.
 *
 * 대상 조건은 `filter`(직접 조건) 또는 `listFilters`(현재 목록 조건) **둘 중 하나**다.
 * 둘 다 없거나 둘 다 있으면 400 — 어느 쪽으로 계산했는지 애매한 채로 실행하면 안 된다.
 */
export function parseBulkRequest(body: unknown): BulkRequestParse {
  const b = (body ?? {}) as {
    mode?: unknown; filter?: unknown; listFilters?: unknown;
    action?: unknown; notify?: unknown; jobId?: unknown;
  };

  if (b.mode !== "preview" && b.mode !== "run") {
    return { ok: false, error: "알 수 없는 요청입니다. (mode)" };
  }
  if (!isBulkAction(b.action)) {
    return { ok: false, error: "알 수 없는 동작입니다." };
  }

  const hasFilter = b.filter !== undefined && b.filter !== null;
  const hasList = b.listFilters !== undefined && b.listFilters !== null;
  if (hasFilter && hasList) {
    return { ok: false, error: "조건은 한 가지만 보내주세요. (filter · listFilters)" };
  }
  if (!hasFilter && !hasList) {
    return { ok: false, error: "조건이 없습니다." };
  }

  let filter: BulkFilter | undefined;
  let listFilters: ListFilters | undefined;

  if (hasFilter) {
    if (typeof b.filter !== "object") return { ok: false, error: "조건이 없습니다." };
    const f = b.filter as {
      usageBefore?: unknown; usageAfter?: unknown; status?: unknown; type?: unknown;
    };
    if (!isStatusFilter(f.status)) return { ok: false, error: "알 수 없는 상태 조건입니다." };
    if (!isTypeFilter(f.type)) return { ok: false, error: "알 수 없는 구분 조건입니다." };

    filter = { status: f.status, type: f.type };
    for (const k of ["usageBefore", "usageAfter"] as const) {
      const v = f[k];
      if (v === undefined || v === null || v === "") continue;
      if (typeof v !== "string" || !ISO_DATE.test(v)) {
        return { ok: false, error: "날짜는 YYYY-MM-DD 형식이어야 합니다." };
      }
      filter[k] = v;
    }
  } else {
    const parsed = parseListFilters(b.listFilters);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    listFilters = parsed.value;
  }

  const jobId = typeof b.jobId === "string" && b.jobId ? b.jobId : undefined;
  if (b.mode === "run" && !jobId) {
    return { ok: false, error: "미리보기를 먼저 해주세요. (jobId 없음)" };
  }

  return {
    ok: true,
    value: {
      mode: b.mode,
      ...(filter ? { filter } : {}),
      ...(listFilters ? { listFilters } : {}),
      action: b.action,
      notify: b.notify === true,
      ...(jobId ? { jobId } : {}),
    },
  };
}

/* ─── 실행 안전장치 ────────────────────────────── */

export const BULK_LOG_REQUIRED_ERROR =
  "실행 기록을 남기지 못해 중단했습니다. 시트 접근 권한/쿼터를 확인하세요.";

/**
 * batchUpdate를 진행해도 되는지 (순수 판정).
 *
 * 되돌리기의 **유일한** 근거가 `_bulk_log`의 스냅샷이다. 로그가 안 남았는데 상태를 바꾸면
 * 최대 500행이 되돌릴 수 없는 상태가 된다 — 그래서 쓰기 **전에** 막는다.
 * 적용할 행이 0건이면 바꿀 것도 없으므로 로그 없이 통과.
 */
export function canApplyBulkWrites(
  appliedCount: number,
  logged: boolean
): { ok: true } | { ok: false; error: string; httpStatus: 500 } {
  if (appliedCount === 0) return { ok: true };
  if (!logged) return { ok: false, error: BULK_LOG_REQUIRED_ERROR, httpStatus: 500 };
  return { ok: true };
}

const ACTION_TEXT: Record<BulkAction, string> = {
  confirm: "입금확인", cancel: "취소", reopen: "되돌리기",
};

/** 기간설정 범위 — 한쪽만 있으면 열린 구간 그대로 보여준다. */
function rangeText(range: ListRange | undefined): string {
  if (!range) return "기간설정";
  const basis = range.basis === "usage" ? "사용일" : "신청일";
  if (!range.from && !range.to) return `${basis} 전체`;
  return `${basis} ${range.from ?? ""}~${range.to ?? ""}`;
}

/** 조건을 사람이 읽는 한 줄로 — 로그·목록 표시용. 직접 조건·목록 조건 둘 다 받는다. */
export function summarizeBulkFilter(cond: BulkCondition, action: BulkAction): string {
  if (isListCondition(cond)) {
    const q = (cond.searchInput ?? "").trim();
    return [
      cond.period === "기간설정" ? rangeText(cond.range) : cond.period,
      cond.statusFilter === "전체" ? "전체상태" : cond.statusFilter,
      cond.typeFilter,
      q ? `검색 "${q}"` : "검색어 없음",
      `→ ${ACTION_TEXT[action]}`,
    ].join(" · ");
  }

  const STATUS: Record<BulkStatusFilter, string> = {
    pending: "입금대기", confirmed: "확정", cancelled: "취소", all: "전체상태",
  };
  const TYPE: Record<BulkTypeFilter, string> = { all: "전체", salon: "살롱", stay: "스테이" };
  const parts: string[] = [];
  if (cond.usageBefore) parts.push(`${cond.usageBefore} 이전`);
  if (cond.usageAfter) parts.push(`${cond.usageAfter} 이후`);
  parts.push(STATUS[cond.status], TYPE[cond.type], `→ ${ACTION_TEXT[action]}`);
  return parts.join(" · ");
}
