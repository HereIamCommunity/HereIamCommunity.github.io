/**
 * 구글 시트 → Supabase 이전 (설계: docs/superpowers/specs/2026-09-19-supabase-migration-design.md 3·4장)
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/migrate-sheets-to-supabase.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/migrate-sheets-to-supabase.ts
 *
 * - 이미 DB에 있는 행(같은 sheet_row)은 **절대 덮어쓰지 않는다**. 새 행만 넣는다.
 *   그래서 배포 후 다시 돌려도 관리자가 바꾼 상태가 시트의 옛 값으로 되돌아가지 않는다.
 * - 시트와 DB 값이 다른 이전 행은 "어긋남"으로 출력만 한다(자동으로 고치지 않음).
 * - 끝에 탭별 시트 행 수와 DB 이전 행 수를 대조하고, 다르면 종료 코드 1.
 * - server-only 모듈(store/supabase/bulk-log 런타임)은 import하지 않는다.
 */

import { google } from "googleapis";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages, type PageResult } from "@/lib/paginate";
import type { SheetTab } from "@/lib/row-ref";
import {
  bulkLogImport,
  diffImported,
  importBookingRow,
  importOpenStayRow,
  importRetreatRow,
  isBlankRow,
  mapSnapshotRefs,
  parseSheetBulkLogRow,
  type Imported,
} from "@/lib/sheet-import";
import { KIND_TAB, type BookingKind } from "@/lib/store-rows";

const DRY = process.argv.includes("--dry-run");
const CHUNK = 500;

type Rec = Record<string, unknown> & { sheet_row: number };
type Sheets = ReturnType<typeof google.sheets>;

type Job = {
  label: string;
  table: "bookings" | "retreats" | "open_stays";
  range: string;
  kind?: BookingKind;
  onConflict: string;
  diffFields: readonly string[];
  build: (values: string[], sheetRow: number) => Imported<Rec>;
};

const JOBS: Job[] = [
  {
    label: "살롱", table: "bookings", range: "살롱!A:O", kind: "salon", onConflict: "kind,sheet_row",
    diffFields: ["status", "notify_status", "memo"],
    build: (v, n) => importBookingRow(v, "salon", n),
  },
  {
    label: "스테이", table: "bookings", range: "스테이!A:O", kind: "stay", onConflict: "kind,sheet_row",
    diffFields: ["status", "notify_status", "memo"],
    build: (v, n) => importBookingRow(v, "stay", n),
  },
  {
    label: "리트릿", table: "retreats", range: "리트릿!A:M", onConflict: "sheet_row",
    diffFields: ["status", "memo"],
    build: (v, n) => importRetreatRow(v, n),
  },
  {
    label: "무료개방", table: "open_stays", range: "무료개방!A:L", onConflict: "sheet_row",
    diffFields: ["status"],
    build: (v, n) => importOpenStayRow(v, n),
  },
];

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`환경변수 ${name}이(가) 없습니다. --env-file=.env.local 을 붙였는지 확인하세요.`);
    process.exit(2);
  }
  return v;
}

/** 탭 읽기. 탭이 없을 때만 빈 배열, 그 밖의 오류는 던진다. */
async function readTab(sheets: Sheets, spreadsheetId: string, range: string): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return (res.data.values as string[][] | null) ?? [];
  } catch (e) {
    if (/Unable to parse range/i.test(String((e as Error)?.message ?? e))) return [];
    throw e;
  }
}

/** DB에 이미 있는 이전 행(sheet_row가 있는 행) 전부 */
function migrated(db: SupabaseClient, table: string, kind?: BookingKind): Promise<Rec[]> {
  return fetchAllPages<Rec>((from, to) => {
    const base = db.from(table).select("*").not("sheet_row", "is", null);
    const q = kind ? base.eq("kind", kind) : base;
    return q.order("id", { ascending: true }).range(from, to) as unknown as PromiseLike<PageResult<Rec>>;
  });
}

async function insertNew(db: SupabaseClient, table: string, rows: Rec[], onConflict: string) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    // ignoreDuplicates: 이미 있는 행은 건드리지 않는다(덮어쓰기 금지)
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict, ignoreDuplicates: true });
    if (error) throw error;
  }
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(env("GOOGLE_SERVICE_ACCOUNT_JSON")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = env("GOOGLE_SHEET_ID");
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(DRY ? "── 드라이런: 아무것도 쓰지 않습니다 ──\n" : "── 이전 시작 ──\n");

  const legacy = await readTab(sheets, sheetId, "신청내역!A:A");
  if (legacy.length > 1) {
    console.warn(`⚠ 옛 탭 '신청내역'에 ${legacy.length - 1}행이 있습니다. 앱이 읽지 않던 탭이라 옮기지 않습니다.\n`);
  }

  const summary: { 탭: string; 시트행: number; 새로넣을행: number; DB이전행: number; 어긋남: number }[] = [];
  let mismatch = false;

  for (const job of JOBS) {
    const values = await readTab(sheets, sheetId, job.range);
    const prepared: Rec[] = [];
    const warnings: string[] = [];
    for (let i = 1; i < values.length; i++) {
      const v = values[i] ?? [];
      if (isBlankRow(v)) continue;
      const { record, warnings: w } = job.build(v, i + 1);
      prepared.push(record);
      warnings.push(...w);
    }

    const before = await migrated(db, job.table, job.kind);
    const bySheetRow = new Map(before.map((r) => [r.sheet_row, r]));
    const fresh = prepared.filter((r) => !bySheetRow.has(r.sheet_row));
    const drift: string[] = [];
    for (const r of prepared) {
      const existing = bySheetRow.get(r.sheet_row);
      if (!existing) continue;
      const fields = diffImported(r, existing, job.diffFields);
      if (fields.length) drift.push(`${job.label} ${r.sheet_row}행 (DB id ${existing.id}): ${fields.join(", ")}`);
    }

    for (const w of warnings) console.warn(`⚠ ${w}`);
    for (const d of drift) console.warn(`≠ 어긋남 ${d}`);

    if (!DRY) await insertNew(db, job.table, fresh, job.onConflict);
    const after = DRY ? before.length + fresh.length : (await migrated(db, job.table, job.kind)).length;

    summary.push({ 탭: job.label, 시트행: prepared.length, 새로넣을행: fresh.length, DB이전행: after, 어긋남: drift.length });
    if (!DRY && after !== prepared.length) mismatch = true;
  }

  /* ── 일괄 처리 로그: 스냅샷의 시트 행 번호를 DB id로 바꿔 옮긴다 ── */
  const logRows = await readTab(sheets, sheetId, "'_bulk_log'!A:H");
  const logs = logRows.map((v, i) => parseSheetBulkLogRow(v ?? [], i + 1)).filter((l) => l !== null);

  if (DRY) {
    summary.push({ 탭: "_bulk_log", 시트행: logs.length, 새로넣을행: logs.length, DB이전행: 0, 어긋남: 0 });
    console.log("\n(드라이런) 일괄 처리 로그는 예약을 옮긴 뒤에만 id를 맞출 수 있어 건수만 셉니다.");
  } else {
    const bookingIds = new Map<string, number>();
    for (const kind of ["salon", "stay"] as const) {
      for (const r of await migrated(db, "bookings", kind)) {
        bookingIds.set(`${KIND_TAB[kind]}#${r.sheet_row}`, Number(r.id));
      }
    }
    const idOf = (tab: SheetTab, sheetRow: number) => bookingIds.get(`${tab}#${sheetRow}`);

    const records: Rec[] = [];
    for (const log of logs) {
      const { snapshot, missing } = mapSnapshotRefs(log.snapshot, idOf);
      for (const m of missing) {
        console.warn(`⚠ _bulk_log ${log.sheetRow}행: 스냅샷 ${m.tab}#${m.sheetRow}에 해당하는 예약이 없어 제외`);
      }
      records.push(bulkLogImport(log, snapshot) as unknown as Rec);
    }

    const beforeLogs = await fetchAllPages<Rec>((from, to) =>
      db.from("bulk_logs").select("*").not("sheet_row", "is", null).order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<PageResult<Rec>>
    );
    const seen = new Set(beforeLogs.map((r) => r.sheet_row));
    const freshLogs = records.filter((r) => !seen.has(r.sheet_row));
    const logDrift = records.filter((r) => {
      const ex = beforeLogs.find((b) => b.sheet_row === r.sheet_row);
      return ex && diffImported(r, ex, ["reverted_at"]).length > 0;
    });
    for (const r of logDrift) console.warn(`≠ 어긋남 _bulk_log ${r.sheet_row}행: reverted_at`);

    await insertNew(db, "bulk_logs", freshLogs, "sheet_row");
    const afterLogs = beforeLogs.length + freshLogs.length;
    summary.push({ 탭: "_bulk_log", 시트행: records.length, 새로넣을행: freshLogs.length, DB이전행: afterLogs, 어긋남: logDrift.length });
    if (afterLogs !== records.length) mismatch = true;
  }

  console.log("");
  console.table(summary);

  if (mismatch) {
    console.error("\n✗ 시트 행 수와 DB 이전 행 수가 다릅니다. 위 경고를 확인하세요.");
    process.exit(1);
  }
  console.log(DRY ? "\n✓ 드라이런 끝." : "\n✓ 이전 끝. 건수가 모두 맞습니다.");
}

main().catch((e) => {
  console.error("✗ 이전 실패:", e);
  process.exit(1);
});
