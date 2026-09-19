/**
 * 일괄 처리 실행 기록 — Supabase `bulk_logs` 테이블 (2026-09-19 전: 시트 `_bulk_log` 탭).
 *
 * 되돌리기는 이 로그의 스냅샷만 보고 복원한다 — 실행 시점의 상태·알림 원값이 여기 없으면
 * 되돌릴 방법이 없으므로, run은 상태를 바꾸기 **전에** 로그를 남긴다.
 * job_id는 unique가 아니다: 되돌린 뒤 같은 대상을 다시 실행하면 같은 jobId가 또 생긴다(조회는 최신 것).
 */

import type { BulkAction, BulkCondition, BulkSnapshotItem } from "@/lib/bulk";
import { normalizeRowRef } from "@/lib/row-ref";
import { getDb } from "@/lib/supabase";

export { kstTimestamp } from "@/lib/kst-datetime";

/** 한 번에 처리할 수 있는 최대 대상 수 */
export const MAX_BULK_TARGETS = 500;

export type BulkLogEntry = {
  jobId: string;
  /** KST "YYYY-MM-DD HH:mm:ss" */
  at: string;
  /** 실행에 쓴 조건 — 직접 조건(BulkFilter) 또는 현재 목록 조건(ListFilters) */
  filter: BulkCondition;
  action: BulkAction;
  notify: boolean;
  count: number;
  snapshot: BulkSnapshotItem[];
  /** 되돌린 시각. 빈 문자열이면 아직 안 되돌림. */
  reverted: string;
  /** bulk_logs.id (되돌림 표시용) */
  id: number;
};

export type BulkLogInput = Omit<BulkLogEntry, "id">;

/** bulk_logs 행 모양 */
export type BulkLogRecord = {
  id: number;
  job_id: string;
  at: string;
  filter: unknown;
  action: string;
  notify: boolean;
  count: number;
  snapshot: unknown;
  reverted_at: string;
};

const LOG_COLUMNS = "id,job_id,at,filter,action,notify,count,snapshot,reverted_at";

/* ─── 순수 변환 ────────────────────────────────── */

export function toLogRecord(e: BulkLogInput): Omit<BulkLogRecord, "id"> {
  return {
    job_id: e.jobId,
    at: e.at,
    filter: e.filter,
    action: e.action,
    notify: e.notify,
    count: e.count,
    snapshot: e.snapshot.map((s) => ({ ref: { tab: s.ref.tab, id: s.ref.id }, status: s.status, notify: s.notify })),
    reverted_at: e.reverted,
  };
}

/** 깨진 값은 빈 배열 — 로그 한 줄 때문에 목록 전체가 죽지 않게. 하나라도 이상하면 전부 버린다. */
export function decodeSnapshot(raw: unknown): BulkSnapshotItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BulkSnapshotItem[] = [];
  for (const it of raw) {
    const item = (it ?? {}) as { ref?: unknown; status?: unknown; notify?: unknown };
    const ref = normalizeRowRef(item.ref);
    if (!ref) return [];
    out.push({
      ref,
      status: typeof item.status === "string" ? item.status : "",
      notify: typeof item.notify === "string" ? item.notify : "",
    });
  }
  return out;
}

export function fromLogRecord(r: BulkLogRecord): BulkLogEntry {
  const filter =
    r.filter && typeof r.filter === "object"
      ? (r.filter as BulkCondition)
      : ({ status: "all", type: "all" } as BulkCondition); // 조건을 못 읽어도 되돌리기는 스냅샷만 있으면 된다
  return {
    jobId: r.job_id,
    at: r.at ?? "",
    filter,
    action: (r.action as BulkAction) ?? "confirm",
    notify: r.notify === true,
    count: Number(r.count ?? 0) || 0,
    snapshot: decodeSnapshot(r.snapshot),
    reverted: (r.reverted_at ?? "").trim(),
    id: r.id,
  };
}

/* ─── DB 입출력 ────────────────────────────────── */

/** 로그 한 줄 추가. 환경변수가 없으면 false. DB 오류는 던진다. */
export async function appendBulkLog(entry: BulkLogInput): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const { error } = await db.from("bulk_logs").insert(toLogRecord(entry));
  if (error) throw error;
  return true;
}

/** 최근 실행 기록 (최신순). 읽기 실패는 throw — "기록 없음"으로 위장하지 않는다. */
export async function readBulkLog(limit = 20): Promise<BulkLogEntry[]> {
  const db = getDb();
  if (!db) return [];
  const { data, error } = await db
    .from("bulk_logs")
    .select(LOG_COLUMNS)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as BulkLogRecord[]).map(fromLogRecord);
}

/** jobId로 로그 한 줄 찾기 (같은 jobId가 여럿이면 가장 최근 것). */
export async function findBulkLog(jobId: string): Promise<BulkLogEntry | null> {
  const db = getDb();
  if (!db) return null;
  const { data, error } = await db
    .from("bulk_logs")
    .select(LOG_COLUMNS)
    .eq("job_id", jobId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? fromLogRecord(data as BulkLogRecord) : null;
}

/** 되돌림 시각을 적는다. 반환: 갱신된 행 수. */
export async function markBulkLogReverted(id: number, at: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const { data, error } = await db.from("bulk_logs").update({ reverted_at: at }).eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length;
}
