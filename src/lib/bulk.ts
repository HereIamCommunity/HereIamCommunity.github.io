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
  filter: BulkFilter;
  action: BulkAction;
  /** 기본 false — 알림 없이 상태만 바꾸는 쪽이 안전한 기본값이다. */
  notify: boolean;
  /** run에서만 필수: preview가 준 잡 식별자 */
  jobId?: string;
};

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

/** `/api/admin/bulk` body 검증 (순수 함수). 틀리면 전부 400. */
export function parseBulkRequest(body: unknown): BulkRequestParse {
  const b = (body ?? {}) as {
    mode?: unknown; filter?: unknown; action?: unknown; notify?: unknown; jobId?: unknown;
  };

  if (b.mode !== "preview" && b.mode !== "run") {
    return { ok: false, error: "알 수 없는 요청입니다. (mode)" };
  }
  if (!isBulkAction(b.action)) {
    return { ok: false, error: "알 수 없는 동작입니다." };
  }
  if (!b.filter || typeof b.filter !== "object") {
    return { ok: false, error: "조건이 없습니다." };
  }

  const f = b.filter as {
    usageBefore?: unknown; usageAfter?: unknown; status?: unknown; type?: unknown;
  };
  if (!isStatusFilter(f.status)) return { ok: false, error: "알 수 없는 상태 조건입니다." };
  if (!isTypeFilter(f.type)) return { ok: false, error: "알 수 없는 구분 조건입니다." };

  const filter: BulkFilter = { status: f.status, type: f.type };
  for (const k of ["usageBefore", "usageAfter"] as const) {
    const v = f[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" || !ISO_DATE.test(v)) {
      return { ok: false, error: "날짜는 YYYY-MM-DD 형식이어야 합니다." };
    }
    filter[k] = v;
  }

  const jobId = typeof b.jobId === "string" && b.jobId ? b.jobId : undefined;
  if (b.mode === "run" && !jobId) {
    return { ok: false, error: "미리보기를 먼저 해주세요. (jobId 없음)" };
  }

  return {
    ok: true,
    value: {
      mode: b.mode,
      filter,
      action: b.action,
      notify: b.notify === true,
      ...(jobId ? { jobId } : {}),
    },
  };
}

/** 조건을 사람이 읽는 한 줄로 — 로그·목록 표시용. */
export function summarizeBulkFilter(filter: BulkFilter, action: BulkAction): string {
  const STATUS: Record<BulkStatusFilter, string> = {
    pending: "입금대기", confirmed: "확정", cancelled: "취소", all: "전체상태",
  };
  const TYPE: Record<BulkTypeFilter, string> = { all: "전체", salon: "살롱", stay: "스테이" };
  const ACTION: Record<BulkAction, string> = {
    confirm: "입금확인", cancel: "취소", reopen: "되돌리기",
  };
  const parts: string[] = [];
  if (filter.usageBefore) parts.push(`${filter.usageBefore} 이전`);
  if (filter.usageAfter) parts.push(`${filter.usageAfter} 이후`);
  parts.push(STATUS[filter.status], TYPE[filter.type], `→ ${ACTION[action]}`);
  return parts.join(" · ");
}
