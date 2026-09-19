/**
 * 주간 백업 JSON → Supabase 복구.
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json> --dry-run
 *   npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json>
 *   npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json> --force
 *
 * - 원래 id 그대로 넣는다. 이미 있는 id는 건너뛴다(덮어쓰지 않음).
 *   테이블별로 "새로 넣음 / 이미 있어 건너뜀" 건수를 출력한다.
 * - 대상 테이블에 이미 행이 있으면 멈춘다. 새 신청이 백업의 id를 먼저 차지했으면 그 백업 행은
 *   조용히 빠지기 때문이다. 확인한 뒤에만 --force로 진행한다(드라이런은 알리기만 한다).
 * - 끝나면 reset_id_sequences()로 다음 id가 겹치지 않게 맞춘다.
 * - server-only 모듈(store/supabase)은 import하지 않는다.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BACKUP_TABLES, parseBackup, restorableRows } from "@/lib/backup";

const CHUNK = 500;

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`환경변수 ${name}이(가) 없습니다. --env-file=.env.local 을 붙였는지 확인하세요.`);
    process.exit(2);
  }
  return v;
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const dry = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  if (!file) {
    console.error("사용: npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json> [--dry-run] [--force]");
    process.exit(2);
  }

  const data = parseBackup(readFileSync(file, "utf8"));
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* 대상 테이블이 비어 있는지 먼저 본다 */
  const existing: { table: string; count: number }[] = [];
  for (const table of BACKUP_TABLES) {
    const { count, error } = await db.from(table).select("id", { count: "exact", head: true });
    if (error) throw error;
    if (count) existing.push({ table, count });
  }
  if (existing.length) {
    console.warn("\n⚠⚠⚠ 대상 테이블에 이미 행이 있습니다 ⚠⚠⚠");
    for (const e of existing) console.warn(`   ${e.table}: ${e.count}건`);
    console.warn(
      "   백업과 같은 id의 행은 건너뛰므로, 그 사이 새 신청이 같은 id를 받았다면 백업 행이 빠집니다.\n" +
        "   새 프로젝트라면 앱이 신청을 받기 전에 복구해야 합니다. 확인했으면 --force를 붙여 다시 실행하세요.\n"
    );
    if (!dry && !force) {
      console.error("✗ 복구하지 않았습니다(--force 없음).");
      process.exit(1);
    }
  }

  for (const table of BACKUP_TABLES) {
    const rows = restorableRows(data[table]);
    if (dry) {
      console.log(`${table}: 백업 ${rows.length}건`);
      continue;
    }
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      // ignoreDuplicates + select: 실제로 새로 들어간 행만 돌아온다
      const { data: added, error } = await db
        .from(table)
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "id", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      inserted += added?.length ?? 0;
    }
    console.log(`${table}: 백업 ${rows.length}건 · 새로 넣음 ${inserted}건 · 이미 있어 건너뜀 ${rows.length - inserted}건`);
  }

  if (dry) {
    console.log("\n(드라이런) 아무것도 쓰지 않았습니다.");
    return;
  }

  const { error } = await db.rpc("reset_id_sequences");
  if (error) throw error;
  console.log("\n✓ 복구 완료. id 시퀀스를 맞췄습니다.");
}

main().catch((e) => {
  console.error("✗ 복구 실패:", e);
  process.exit(1);
});
