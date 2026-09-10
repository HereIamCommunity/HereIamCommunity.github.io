import { NextRequest, NextResponse } from "next/server";
import { resolveStatusAction } from "@/lib/admin-actions";
import { parseAdminRow } from "@/lib/admin-row";
import {
  bulkJobId,
  canApplyBulkWrites,
  parseBulkRequest,
  planBulkWrites,
  selectBulkTargets,
  summarizeBulkFilter,
  type BulkTarget,
} from "@/lib/bulk";
import {
  appendBulkLog,
  kstTimestamp,
  readBulkLog,
  MAX_BULK_TARGETS,
} from "@/lib/bulk-log";
import { notifyBooking, notifyStatusText } from "@/lib/messaging";
import { batchUpdateCells, getAllBookingsWithMeta } from "@/lib/sheets";
import { postSlack } from "@/lib/slack";
import { buildSimpleBlocks } from "@/lib/slack-blocks";
import { refCellRange, type RowRef } from "@/lib/row-ref";

/**
 * 일괄 처리 — 조건으로 대상을 고르고(preview) 한 번에 실행한다(run).
 *
 * body: { mode: "preview" | "run";
 *         filter: { usageBefore?: "YYYY-MM-DD"; usageAfter?: "YYYY-MM-DD";
 *                   status: "pending"|"confirmed"|"cancelled"|"all"; type: "all"|"salon"|"stay" };
 *         action: "confirm" | "cancel" | "reopen";
 *         notify?: boolean;      // 기본 false — 알림 없이 상태만 바꾼다
 *         jobId?: string }       // run 필수: preview가 준 값
 *
 * **쿼터 규약(중요)**: 2026-09-10 운영에서 99건을 건별 API로 돌렸다가 행마다 시트를 다시 읽어
 * 읽기 쿼터(429)에 걸렸다. 그래서 run은 **읽기 1회 + batchUpdate 1회**로 끝낸다.
 * notify:true여도 `notifyBooking(..., { recordToSheet: false })`로 발송만 하고
 * O열은 맨 끝에 batchUpdate 한 번으로 몰아 쓴다(행당 읽기 0).
 *
 * GET → `_bulk_log` 최근 20건.
 */

const NOTIFY_GAP_MS = 150;

const refKey = (r: RowRef) => `${r.tab}#${r.rowNum}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  if (req.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    // readBulkLog는 탭이 아직 없을 때만 빈 배열을 준다. 권한·쿼터 오류는 던져서 500으로 드러난다
    // — 읽기 실패를 "기록 없음"으로 보여주면 운영자가 되돌리기 대상을 놓친다.
    const jobs = (await readBulkLog(20)).map((e) => ({
      jobId: e.jobId,
      at: e.at,
      summary: summarizeBulkFilter(e.filter, e.action),
      action: e.action,
      notify: e.notify,
      count: e.count,
      reverted: e.reverted,
    }));
    return NextResponse.json({ ok: true, jobs });
  } catch (e) {
    console.error("[BULK GET] 로그 읽기 실패", e);
    return NextResponse.json(
      { ok: false, error: "실행 기록을 읽지 못했습니다(시트 오류)." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-password") !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseBulkRequest(await req.json().catch(() => undefined));
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const { mode, filter, action, notify } = parsed.value;

  try {
    const now = new Date();

    // 읽기 1회 — 이 배열 하나로 preview·run 모두 계산한다.
    const { rows, meta } = await getAllBookingsWithMeta();
    const targets = selectBulkTargets(rows, meta, filter, now);
    const jobId = bulkJobId(targets.map((t) => t.ref));

    if (mode === "preview") {
      return NextResponse.json({
        ok: true,
        mode: "preview",
        jobId,
        count: targets.length,
        byType: {
          salon: targets.filter((t) => t.type === "salon").length,
          stay: targets.filter((t) => t.type === "stay").length,
        },
        rows: targets.map((t) => ({
          ref: t.ref, name: t.name, type: t.type, usage: t.usage, status: t.status,
        })),
      });
    }

    /* ── run ── */
    if (parsed.value.jobId !== jobId) {
      return NextResponse.json(
        {
          ok: false,
          error: "대상이 바뀌었어요. 미리보기를 다시 해주세요.",
          jobId,
          count: targets.length,
        },
        { status: 409 }
      );
    }
    if (targets.length > MAX_BULK_TARGETS) {
      return NextResponse.json(
        { ok: false, error: `한 번에 ${MAX_BULK_TARGETS}건까지만 처리할 수 있습니다.` },
        { status: 400 }
      );
    }

    const plan = planBulkWrites(targets, action, notify, now);
    const at = kstTimestamp(now);

    // 스냅샷을 먼저 남긴다 — 되돌리기의 유일한 근거다.
    // 로그가 안 남으면 **아무것도 쓰지 않고 중단**한다. 여기서 그냥 진행하면
    // 최대 500행이 되돌릴 수 없는 상태가 된다.
    let logged = false;
    if (plan.applied.length > 0) {
      try {
        logged = await appendBulkLog({
          jobId, at, filter, action, notify,
          count: plan.applied.length,
          snapshot: plan.snapshot,
          reverted: "",
        });
      } catch (e) {
        console.error("[BULK] 로그 기록 실패", e);
      }
    }

    const gate = canApplyBulkWrites(plan.applied.length, logged);
    if (!gate.ok) {
      console.error(`[BULK] 로그를 남기지 못해 중단 job=${jobId} applied=${plan.applied.length}`);
      return NextResponse.json(
        { ok: false, error: gate.error, jobId, count: targets.length },
        { status: gate.httpStatus }
      );
    }

    // 쓰기 1회
    if (plan.writes.length > 0) await batchUpdateCells(plan.writes);

    const failed: { ref: RowRef; name: string; error: string }[] = [];
    let notified = 0;

    if (notify && plan.applied.length > 0) {
      const byRef = new Map<string, BulkTarget>(targets.map((t) => [refKey(t.ref), t]));
      const notifyCells: { range: string; values: string[][] }[] = [];

      for (let i = 0; i < plan.applied.length; i++) {
        const ref = plan.applied[i];
        const t = byRef.get(refKey(ref));
        if (!t) continue;
        const resolved = resolveStatusAction("booking", t.status, action);
        if (!resolved.ok || !resolved.event) continue;

        if (i > 0) await sleep(NOTIFY_GAP_MS);
        try {
          // recordToSheet:false — O열은 아래에서 batchUpdate 한 번으로 몰아 쓴다(행당 읽기 0).
          const result = await notifyBooking(resolved.event, parseAdminRow(t.row), {
            recordToSheet: false,
          });
          notifyCells.push({
            range: refCellRange(ref, "O"),
            values: [[notifyStatusText(resolved.event, result)]],
          });
          if (result.guest === "ok") notified++;
          else if (typeof result.guest === "object") {
            failed.push({ ref, name: t.name, error: result.guest.error });
          }
        } catch (e) {
          // 한 건 실패해도 나머지는 계속 보낸다.
          failed.push({ ref, name: t.name, error: String(e) });
        }
      }

      if (notifyCells.length > 0) {
        try {
          await batchUpdateCells(notifyCells);
        } catch (e) {
          console.error("[BULK] 알림 결과 기록 실패", e);
        }
      }
    }

    console.log(
      `[BULK] job=${jobId} action=${action} notify=${notify} applied=${plan.applied.length}` +
        ` skipped=${plan.skipped.length} notified=${notified} failed=${failed.length}`
    );

    // 운영자 슬랙 알림 — 실패해도 일괄 처리 결과는 그대로 돌려준다.
    try {
      await postSlack(
        buildSimpleBlocks(
          "📦 일괄 처리 실행",
          [
            { label: "조건", value: summarizeBulkFilter(filter, action) },
            { label: "처리", value: `${plan.applied.length}건` },
            { label: "건너뜀", value: `${plan.skipped.length}건` },
            { label: "알림", value: notify ? `보냄 ${notified}건 · 실패 ${failed.length}건` : "없음" },
            { label: "실행자", value: "어드민" },
          ],
          `되돌리려면 어드민 일괄 처리 탭에서 ${at} 기록을 열어주세요.`
        )
      );
    } catch (e) {
      console.warn("[BULK] 슬랙 알림 실패", e);
    }

    return NextResponse.json({
      ok: true,
      mode: "run",
      jobId,
      at,
      updated: plan.applied.length,
      notified,
      skipped: plan.skipped,
      failed,
      logged,
    });
  } catch (e) {
    console.error("[BULK POST]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
