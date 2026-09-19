import { NextRequest, NextResponse } from "next/server";
import { BACKUP_TABLES, buildBackup } from "@/lib/backup";
import { reportDbFailure } from "@/lib/db-alert";
import { sendOperatorNotice } from "@/lib/email";
import { dumpAllTables } from "@/lib/store";

/**
 * 주간 백업 (Vercel Cron, 월요일 03:00 KST).
 * 무료 플랜은 백업을 내려받을 수 없어서, 네 테이블 전체를 JSON으로 운영자 메일에 첨부한다.
 * 받는 곳: BACKUP_EMAIL, 없으면 OPERATOR_EMAIL. 연락처가 들어 있으니 운영자 전용 메일함으로.
 * 복구: docs/runbook-supabase.md
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backup = buildBackup(await dumpAllTables(), new Date());
    const lines = BACKUP_TABLES.map((t) => `- ${t} ${backup.counts[t]}건`);
    const warn = backup.tooLarge
      ? `\n⚠ 백업 파일이 ${(backup.bytes / 1024 / 1024).toFixed(1)}MB입니다. 메일 첨부 한도(40MB)에 가까워지면 백업 방식을 바꿔야 합니다.\n`
      : "";

    await sendOperatorNotice(
      `[코이노니아] 주간 백업 ${backup.filename.slice(16, 26)}`,
      `첨부된 JSON 파일이 이번 주 전체 데이터입니다. 지우지 말고 보관해주세요.\n\n${lines.join("\n")}\n${warn}\n복구 방법: docs/runbook-supabase.md`,
      {
        to: process.env.BACKUP_EMAIL || undefined,
        attachments: [{ filename: backup.filename, content: Buffer.from(backup.json) }],
      }
    );

    return NextResponse.json({ ok: true, counts: backup.counts, bytes: backup.bytes });
  } catch (e) {
    await reportDbFailure("주간 백업", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
