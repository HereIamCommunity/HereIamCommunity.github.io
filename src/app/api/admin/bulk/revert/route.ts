import { NextRequest, NextResponse } from "next/server";
import { planRevertWrites } from "@/lib/bulk";
import { findBulkLog, kstTimestamp, markBulkLogReverted } from "@/lib/bulk-log";
import { batchUpdateCells } from "@/lib/sheets";
import { summarizeBulkFilter } from "@/lib/bulk";
import { postSlack } from "@/lib/slack";
import { buildSimpleBlocks } from "@/lib/slack-blocks";

/**
 * 일괄 처리 되돌리기 — `_bulk_log`의 스냅샷(실행 직전 N·O 원값)을 그대로 다시 쓴다.
 * 알림은 보내지 않는다.
 *
 * body: { jobId: string }
 * res:  { ok: true; jobId; restored; cellsUpdated; at } | { ok: false; error }
 * 400 jobId 없음 / 404 로그 없음 / 409 이미 되돌림
 *
 * 읽기 1회(로그) + 쓰기 1회(batchUpdate) + 로그 표시 1회.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { jobId?: unknown };
  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId가 없습니다." }, { status: 400 });
  }

  // 읽기 실패와 "기록 없음"을 구분한다. 시트 오류를 404로 보여주면 운영자가
  // 되돌리기를 포기하고 재실행하는 최악의 경로로 간다.
  let entry: Awaited<ReturnType<typeof findBulkLog>>;
  try {
    entry = await findBulkLog(jobId);
  } catch (e) {
    console.error("[BULK REVERT] 로그 읽기 실패", e);
    return NextResponse.json(
      { ok: false, error: "실행 기록을 읽지 못했습니다(시트 오류). 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }

  try {
    if (!entry) {
      return NextResponse.json(
        { ok: false, error: "일괄 처리 기록을 찾지 못했습니다." },
        { status: 404 }
      );
    }
    if (entry.reverted) {
      return NextResponse.json(
        { ok: false, error: `이미 ${entry.reverted}에 되돌렸습니다.`, reverted: entry.reverted },
        { status: 409 }
      );
    }
    if (entry.snapshot.length === 0) {
      return NextResponse.json(
        { ok: false, error: "되돌릴 스냅샷이 없습니다." },
        { status: 409 }
      );
    }

    const cellsUpdated = await batchUpdateCells(planRevertWrites(entry.snapshot));
    const at = kstTimestamp();
    try {
      await markBulkLogReverted(entry.rowNum, at);
    } catch (e) {
      console.error("[BULK REVERT] 로그 표시 실패", e);
    }

    console.log(`[BULK REVERT] job=${jobId} restored=${entry.snapshot.length}`);

    // 운영자 슬랙 알림 — 실패해도 되돌리기 결과는 그대로 돌려준다.
    try {
      await postSlack(
        buildSimpleBlocks(
          "📦 일괄 처리 되돌리기",
          [
            { label: "조건", value: summarizeBulkFilter(entry.filter, entry.action) },
            { label: "복구", value: `${entry.snapshot.length}건` },
            { label: "원래 실행", value: entry.at },
            { label: "실행자", value: "어드민" },
          ],
          "되돌리기는 알림을 보내지 않습니다."
        )
      );
    } catch (e) {
      console.warn("[BULK REVERT] 슬랙 알림 실패", e);
    }

    return NextResponse.json({
      ok: true,
      jobId,
      restored: entry.snapshot.length,
      cellsUpdated,
      at,
    });
  } catch (e) {
    console.error("[BULK REVERT]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
