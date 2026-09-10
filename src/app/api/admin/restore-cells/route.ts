import { NextRequest, NextResponse } from "next/server";
import { parseRestoreRequest, toBatchData } from "@/lib/restore-cells";
import { batchUpdateCells } from "@/lib/sheets";

/**
 * 예약 행의 상태(N)·알림(O) 셀 일괄 복원. 알림 발송 없음.
 * body: { items: { ref: { tab, rowNum }, status, notify }[] }
 */
export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const parsed = parseRestoreRequest(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  try {
    const updated = await batchUpdateCells(toBatchData(parsed.items));
    return NextResponse.json({ ok: true, items: parsed.items.length, cellsUpdated: updated });
  } catch (e) {
    console.error("[RESTORE-CELLS]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
