/**
 * 일괄 처리 실행 기록 — 구글 시트 `_bulk_log` 탭.
 *
 * 스프레드시트가 단일 진실 원천이라 로그도 시트에 둔다(별도 DB 없음).
 * 되돌리기는 이 로그의 스냅샷만 보고 복원한다 — 실행 시점의 N·O 원값이 여기 없으면
 * 되돌릴 방법이 없으므로, run은 batchUpdate **전에** 로그를 남긴다.
 *
 * 열: A jobId · B 시각(KST) · C 조건 JSON · D 동작 · E 알림 · F 건수 · G 스냅샷 JSON · H 되돌림
 */

import type { BulkAction, BulkCondition, BulkSnapshotItem } from "@/lib/bulk";
import { isSheetTab, type SheetTab } from "@/lib/row-ref";
import {
  a1Tab,
  appendSheetRow,
  batchUpdateCells,
  ensureSheetTab,
  isMissingRangeError,
  readSheetRange,
} from "@/lib/sheets";

export const BULK_LOG_TAB = "_bulk_log";
export const BULK_LOG_HEADER = [
  "jobId", "시각", "조건", "동작", "알림", "건수", "스냅샷", "되돌림",
];

/** 한 셀(5만자 제한)에 담기게 유지하려고 대상 수를 제한한다. */
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
  /** `_bulk_log` 탭의 시트 행 번호 (되돌림 표시용) */
  rowNum: number;
};

export type BulkLogInput = Omit<BulkLogEntry, "rowNum">;

/* ─── 순수 직렬화 ──────────────────────────────── */

/** 실제 시각 → KST "YYYY-MM-DD HH:mm:ss" */
export function kstTimestamp(now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  // sv-SE 로케일은 "2026-09-10 14:32:05" 형태를 준다.
  return p.format(now).replace("T", " ");
}

/** 스냅샷을 `[["살롱#2","신청",""], …]`로 — 99건도 한 셀에 들어가도록 짧게. */
export function encodeSnapshot(items: BulkSnapshotItem[]): string {
  return JSON.stringify(items.map((i) => [`${i.ref.tab}#${i.ref.rowNum}`, i.status, i.notify]));
}

/** 깨진 값은 빈 배열 — 로그 한 줄 때문에 목록 전체가 죽지 않게. */
export function decodeSnapshot(raw: string): BulkSnapshotItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: BulkSnapshotItem[] = [];
  for (const it of parsed) {
    if (!Array.isArray(it) || typeof it[0] !== "string") return [];
    const [tab, num] = it[0].split("#");
    const rowNum = Number(num);
    if (!isSheetTab(tab) || !Number.isInteger(rowNum) || rowNum < 2) return [];
    out.push({
      ref: { tab: tab as SheetTab, rowNum },
      status: typeof it[1] === "string" ? it[1] : "",
      notify: typeof it[2] === "string" ? it[2] : "",
    });
  }
  return out;
}

export function toLogRow(e: BulkLogInput): string[] {
  return [
    e.jobId,
    e.at,
    JSON.stringify(e.filter),
    e.action,
    e.notify ? "발송" : "없음",
    String(e.count),
    encodeSnapshot(e.snapshot),
    e.reverted,
  ];
}

export function parseLogRow(row: string[], rowNum: number): BulkLogEntry | null {
  const jobId = (row?.[0] ?? "").trim();
  if (!jobId || jobId === BULK_LOG_HEADER[0]) return null;

  let filter: BulkCondition = { status: "all", type: "all" };
  try {
    const f = JSON.parse(row[2] || "{}");
    if (f && typeof f === "object") filter = f as BulkCondition;
  } catch {
    /* 조건을 못 읽어도 되돌리기는 스냅샷만 있으면 된다 */
  }

  return {
    jobId,
    at: row[1] ?? "",
    filter,
    action: (row[3] as BulkAction) ?? "confirm",
    notify: (row[4] ?? "") === "발송",
    count: Number(row[5] ?? 0) || 0,
    snapshot: decodeSnapshot(row[6] ?? ""),
    reverted: (row[7] ?? "").trim(),
    rowNum,
  };
}

/* ─── 시트 I/O ─────────────────────────────────── */

/** 로그 한 줄 추가. 탭이 없으면 헤더와 함께 만든다. */
export async function appendBulkLog(entry: BulkLogInput): Promise<boolean> {
  const ready = await ensureSheetTab(BULK_LOG_TAB, BULK_LOG_HEADER);
  if (!ready) return false;
  return appendSheetRow(BULK_LOG_TAB, toLogRow(entry));
}

/**
 * 로그 탭 전체를 읽는다. **아직 탭이 없을 때만** 빈 배열,
 * 권한·쿼터 등 진짜 오류는 그대로 던진다 — 읽기 실패가 "기록 없음"으로 위장되면
 * 되돌리기가 404 오답을 내고 운영자가 재실행할 수 있다.
 */
async function readLogRows(): Promise<string[][]> {
  try {
    return await readSheetRange(`${a1Tab(BULK_LOG_TAB)}!A:H`);
  } catch (e) {
    if (isMissingRangeError(e)) return [];
    throw e;
  }
}

/** 최근 실행 기록 (최신순). 탭이 없으면 빈 배열, 읽기 실패는 throw. */
export async function readBulkLog(limit = 20): Promise<BulkLogEntry[]> {
  const rows = await readLogRows();
  const entries: BulkLogEntry[] = [];
  for (let i = rows.length - 1; i >= 0 && entries.length < limit; i--) {
    const e = parseLogRow(rows[i] ?? [], i + 1);
    if (e) entries.push(e);
  }
  return entries;
}

/** jobId로 로그 한 줄 찾기 (같은 jobId가 여럿이면 가장 최근 것). */
export async function findBulkLog(jobId: string): Promise<BulkLogEntry | null> {
  const rows = await readLogRows();
  for (let i = rows.length - 1; i >= 0; i--) {
    const e = parseLogRow(rows[i] ?? [], i + 1);
    if (e && e.jobId === jobId) return e;
  }
  return null;
}

/** 되돌림 시각을 H열에 적는다. */
export async function markBulkLogReverted(rowNum: number, at: string): Promise<number> {
  return batchUpdateCells([{ range: `${a1Tab(BULK_LOG_TAB)}!H${rowNum}`, values: [[at]] }]);
}
