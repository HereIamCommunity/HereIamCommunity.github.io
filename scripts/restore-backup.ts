/**
 * 주간 백업 JSON → Supabase 복구.
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json> --dry-run
 *   npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json>
 *
 * - 원래 id 그대로 넣는다. 이미 있는 id는 건너뛴다(덮어쓰지 않음).
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
  if (!file) {
    console.error("사용: npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json> [--dry-run]");
    process.exit(2);
  }

  const data = parseBackup(readFileSync(file, "utf8"));
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of BACKUP_TABLES) {
    const rows = restorableRows(data[table]);
    console.log(`${table}: 백업 ${rows.length}건`);
    if (dry) continue;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db
        .from(table)
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    }
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
