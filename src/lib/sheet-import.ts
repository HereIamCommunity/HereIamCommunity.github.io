/**
 * 구글 시트 행 → DB 레코드 변환 — 순수 로직. 이전 스크립트(scripts/migrate-sheets-to-supabase.ts) 전용.
 *
 * 원칙: 데이터를 조용히 버리지 않는다. 신청일시·금액을 못 읽으면 DB 칸은 비우고
 * 원래 값을 메모 칸 끝에 남긴 뒤 경고를 낸다.
 * 시트 API는 행 뒤쪽 빈 칸을 잘라서 주므로 없는 칸은 빈 문자열로 본다.
 */

import type { BulkAction, BulkCondition, BulkSnapshotItem } from "@/lib/bulk";
import type { BulkLogRecord } from "@/lib/bulk-log";
import { parseKstDateTime } from "@/lib/kst-datetime";
import { isSheetTab, type SheetTab } from "@/lib/row-ref";
import {
  KIND_TAB,
  type BookingKind,
  type BookingRecord,
  type OpenStayRecord,
  type RetreatRecord,
} from "@/lib/store-rows";

export type BookingImport = Omit<BookingRecord, "id"> & { sheet_row: number };
export type RetreatImport = Omit<RetreatRecord, "id"> & { sheet_row: number };
export type OpenStayImport = Omit<OpenStayRecord, "id"> & { sheet_row: number };
export type BulkLogImport = Omit<BulkLogRecord, "id"> & { sheet_row: number };
export type Imported<T> = { record: T; warnings: string[] };

const cell = (v: string[], i: number) => String(v[i] ?? "").trim();
const withNote = (text: string, note: string) => (text ? `${text}\n${note}` : note);

export function isBlankRow(values: string[]): boolean {
  return values.every((v) => !String(v ?? "").trim());
}

/** 신청일시: 비면 null(수기 행, 경고 없음), 못 읽으면 null + 메모에 보존 + 경고 */
function importCreated(raw: string, where: string, warnings: string[], keep: (note: string) => void): string | null {
  if (!raw) return null;
  const d = parseKstDateTime(raw);
  if (d) return d.toISOString();
  warnings.push(`${where}: 신청일시 형식을 못 읽음 "${raw}" → 메모에 보존`);
  keep(`[이전 전 신청일시: ${raw}]`);
  return null;
}

const PLAIN_AMOUNT = /^[₩\s\d,]+원?$/;
/** Postgres integer 최댓값. 넘으면 청크 전체 insert가 실패한다. */
const PG_INT_MAX = 2147483647;

export function importBookingRow(values: string[], kind: BookingKind, sheetRow: number): Imported<BookingImport> {
  const where = `${KIND_TAB[kind]} ${sheetRow}행`;
  const warnings: string[] = [];
  let memo = cell(values, 12);

  const created_at = importCreated(cell(values, 0), where, warnings, (n) => (memo = withNote(memo, n)));

  const rawAmount = cell(values, 11);
  let total_amount: number | null = null;
  if (rawAmount) {
    // 숫자·쉼표·공백·₩·끝의 '원'만 허용. "150,000원 (2박)"·"15만원"처럼 다른 글자가 섞이면
    // 숫자만 이어 붙이면 엉뚱한 값(1500002, 15)이 되므로 읽지 않는다.
    const digits = rawAmount.replace(/\D/g, "");
    const amount = PLAIN_AMOUNT.test(rawAmount) && digits ? Number(digits) : NaN;
    if (amount <= PG_INT_MAX) {
      total_amount = amount;
    } else {
      warnings.push(`${where}: 금액을 숫자로 못 읽음 "${rawAmount}" → 요청사항에 보존`);
      memo = withNote(memo, `[이전 전 금액: ${rawAmount}]`);
    }
  }

  return {
    record: {
      sheet_row: sheetRow,
      kind,
      created_at,
      name: cell(values, 2),
      phone: cell(values, 3),
      program: cell(values, 4),
      date_text: cell(values, 5),
      room: cell(values, 6),
      nights: cell(values, 7),
      check_in: cell(values, 8),
      check_out: cell(values, 9),
      discount: cell(values, 10),
      total_amount,
      memo,
      status: cell(values, 13),
      notify_status: cell(values, 14),
    },
    warnings,
  };
}

export function importRetreatRow(values: string[], sheetRow: number): Imported<RetreatImport> {
  const warnings: string[] = [];
  let memo = cell(values, 8);
  const created_at = importCreated(cell(values, 0), `리트릿 ${sheetRow}행`, warnings, (n) => (memo = withNote(memo, n)));
  return {
    record: {
      sheet_row: sheetRow,
      created_at,
      name: cell(values, 1),
      phone: cell(values, 2),
      grade: cell(values, 3),
      region: cell(values, 4),
      session: cell(values, 5),
      referral: cell(values, 6),
      question: cell(values, 7),
      memo,
      allergy: cell(values, 9),
      care: cell(values, 10),
      parent_note: cell(values, 11),
      status: cell(values, 12),
    },
    warnings,
  };
}

export function importOpenStayRow(values: string[], sheetRow: number): Imported<OpenStayImport> {
  const warnings: string[] = [];
  let message = cell(values, 10);
  const created_at = importCreated(cell(values, 0), `무료개방 ${sheetRow}행`, warnings, (n) => (message = withNote(message, n)));
  return {
    record: {
      sheet_row: sheetRow,
      created_at,
      name: cell(values, 1),
      phone: cell(values, 2),
      email: cell(values, 3),
      check_in: cell(values, 4),
      check_out: cell(values, 5),
      group_type: cell(values, 6),
      group_size: cell(values, 7),
      reason: cell(values, 8),
      contribution: cell(values, 9),
      message,
      status: cell(values, 11),
    },
    warnings,
  };
}

/* ─── 일괄 처리 로그 (`_bulk_log` 탭) ──────────── */

export type SheetSnapshotItem = { tab: SheetTab; sheetRow: number; status: string; notify: string };

export type SheetBulkLog = {
  sheetRow: number;
  jobId: string;
  at: string;
  filter: BulkCondition;
  action: BulkAction;
  notify: boolean;
  count: number;
  snapshot: SheetSnapshotItem[];
  /** G열에 값이 있는데 읽지 못해 스냅샷이 비었다 → 이 작업은 되돌릴 수 없다 */
  snapshotUnreadable: boolean;
  reverted: string;
};

/** 시트 스냅샷 `[["살롱#2","신청",""], …]`. 하나라도 이상하면 빈 배열(옛 decodeSnapshot과 같다). */
function decodeSheetSnapshot(raw: string): SheetSnapshotItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: SheetSnapshotItem[] = [];
  for (const it of parsed) {
    if (!Array.isArray(it) || typeof it[0] !== "string") return [];
    const [tab, num] = it[0].split("#");
    const sheetRow = Number(num);
    if (!isSheetTab(tab) || !Number.isInteger(sheetRow) || sheetRow < 2) return [];
    out.push({
      tab,
      sheetRow,
      status: typeof it[1] === "string" ? it[1] : "",
      notify: typeof it[2] === "string" ? it[2] : "",
    });
  }
  return out;
}

/** 열: A jobId · B 시각 · C 조건 JSON · D 동작 · E 알림(발송/없음) · F 건수 · G 스냅샷 · H 되돌림 */
export function parseSheetBulkLogRow(values: string[], sheetRow: number): SheetBulkLog | null {
  const jobId = cell(values, 0);
  if (!jobId || jobId === "jobId") return null;

  let filter: BulkCondition = { status: "all", type: "all" };
  try {
    const f = JSON.parse(cell(values, 2) || "{}");
    if (f && typeof f === "object") filter = f as BulkCondition;
  } catch {
    /* 조건을 못 읽어도 되돌리기는 스냅샷만 있으면 된다 */
  }

  const rawSnapshot = cell(values, 6);
  const snapshot = decodeSheetSnapshot(rawSnapshot);

  return {
    sheetRow,
    jobId,
    at: cell(values, 1),
    filter,
    action: (cell(values, 3) || "confirm") as BulkAction,
    notify: cell(values, 4) === "발송",
    count: Number(cell(values, 5)) || 0,
    snapshot,
    snapshotUnreadable: rawSnapshot !== "" && snapshot.length === 0,
    reverted: cell(values, 7),
  };
}

/** 스냅샷의 시트 행 번호를 DB id로. 못 찾은 항목은 missing으로 돌려준다(스크립트가 경고). */
export function mapSnapshotRefs(
  items: SheetSnapshotItem[],
  idOf: (tab: SheetTab, sheetRow: number) => number | undefined
): { snapshot: BulkSnapshotItem[]; missing: SheetSnapshotItem[] } {
  const snapshot: BulkSnapshotItem[] = [];
  const missing: SheetSnapshotItem[] = [];
  for (const it of items) {
    const id = idOf(it.tab, it.sheetRow);
    if (id === undefined) missing.push(it);
    else snapshot.push({ ref: { tab: it.tab, id }, status: it.status, notify: it.notify });
  }
  return { snapshot, missing };
}

export function bulkLogImport(log: SheetBulkLog, snapshot: BulkSnapshotItem[]): BulkLogImport {
  return {
    sheet_row: log.sheetRow,
    job_id: log.jobId,
    at: log.at,
    filter: log.filter,
    action: log.action,
    notify: log.notify,
    count: log.count,
    snapshot,
    reverted_at: log.reverted,
  };
}

/* ─── 어긋남 ───────────────────────────────────── */

/** 이미 DB에 있는 이전 행과 시트 값이 다른 칸 이름. null과 빈 문자열은 같다고 본다. */
export function diffImported(
  sheetRec: Record<string, unknown>,
  dbRec: Record<string, unknown>,
  fields: readonly string[]
): string[] {
  const norm = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return fields.filter((f) => norm(sheetRec[f]) !== norm(dbRec[f]));
}

/**
 * 같은 sheet_row의 DB 행이 정말 같은 신청인지(행이 밀리지 않았는지) — 신청일시·이름·연락처 숫자.
 * 다르면 다른 칸 이름을 돌려준다. 신청일시는 시각으로 비교하고(DB는 "+00:00" 표기), null과 빈 문자열은 같다.
 */
export function identityMismatch(sheetRec: Record<string, unknown>, dbRec: Record<string, unknown>): string[] {
  const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
  const time = (v: unknown) => {
    const t = text(v);
    if (!t) return "";
    const ms = Date.parse(t);
    return Number.isNaN(ms) ? t : String(ms);
  };
  const digits = (v: unknown) => text(v).replace(/\D/g, "");
  const out: string[] = [];
  if (time(sheetRec.created_at) !== time(dbRec.created_at)) out.push("created_at");
  if (text(sheetRec.name) !== text(dbRec.name)) out.push("name");
  if (digits(sheetRec.phone) !== digits(dbRec.phone)) out.push("phone");
  return out;
}
