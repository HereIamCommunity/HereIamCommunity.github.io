import { NextRequest, NextResponse } from "next/server";
import { reportDbFailure } from "@/lib/db-alert";
import { checkDbHealth } from "@/lib/store";

/**
 * 매일 DB 점검 (Vercel Cron). 두 가지 일을 한다.
 * 1. 매일 조회가 있으니 Supabase 무료 플랜의 7일 무활동 일시정지가 걸리지 않는다.
 * 2. 조회가 실패하면(일시정지·키 오류·장애) 운영자에게 경고를 보낸다.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  // CRON_SECRET이 없으면 undefined === undefined로 누구나 통과하므로 막는다
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkDbHealth();
  if (!result.ok) {
    await reportDbFailure(`매일 DB 점검 (${result.table})`, result.error);
    return NextResponse.json({ ok: false, table: result.table }, { status: 503 });
  }
  return NextResponse.json({ ok: true, checked: result.tables });
}
