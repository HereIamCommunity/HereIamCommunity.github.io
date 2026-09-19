/**
 * 주간 백업 파일 — 순수 로직 (cron과 복구 스크립트가 같이 쓴다).
 *
 * Supabase 무료 플랜은 백업을 내려받을 수 없다. 그래서 매주 네 테이블 전체를
 * JSON 파일 하나로 묶어 운영자 메일에 첨부한다. 복구는 scripts/restore-backup.ts.
 * 이 파일은 server-only 모듈을 import하지 않는다(스크립트에서도 쓴다).
 */

import { kstTimestamp } from "@/lib/kst-datetime";

export const BACKUP_TABLES = ["bookings", "retreats", "open_stays", "bulk_logs"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupData = Record<BackupTable, Record<string, unknown>[]>;

/** 메일 첨부 한도(40MB)보다 한참 아래에서 미리 경고한다 */
export const BACKUP_WARN_BYTES = 10 * 1024 * 1024;

/** DB가 계산하는 컬럼 — 복구 때 넣으면 오류가 난다 */
const GENERATED_COLUMNS = ["phone_digits"];

export function buildBackup(tables: BackupData, now: Date) {
  const json = JSON.stringify({ version: 1, createdAt: now.toISOString(), tables });
  const bytes = Buffer.byteLength(json);
  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, tables[t].length])) as Record<BackupTable, number>;
  return {
    filename: `koinonia-backup-${kstTimestamp(now).slice(0, 10)}.json`,
    json,
    bytes,
    counts,
    tooLarge: bytes > BACKUP_WARN_BYTES,
  };
}

export function parseBackup(json: string): BackupData {
  const parsed = JSON.parse(json) as { version?: unknown; tables?: Record<string, unknown> };
  if (parsed?.version !== 1 || !parsed.tables || typeof parsed.tables !== "object") {
    throw new Error("코이노니아 백업 파일이 아닙니다 (version/tables 없음).");
  }
  const out = {} as BackupData;
  for (const t of BACKUP_TABLES) {
    const rows = parsed.tables[t];
    if (!Array.isArray(rows)) throw new Error(`백업 파일에 ${t} 테이블이 없습니다.`);
    out[t] = rows as Record<string, unknown>[];
  }
  return out;
}

export function restorableRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const copy = { ...r };
    for (const c of GENERATED_COLUMNS) delete copy[c];
    return copy;
  });
}
