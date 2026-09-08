import { NextRequest, NextResponse } from "next/server";
import {
  getAllBookingsWithMeta,
  getAllRetreatsWithMeta,
  getAllOpenStaysWithMeta,
} from "@/lib/sheets";

/**
 * 어드민 목록.
 * res: { rows, retreats, openStays, meta, retreatMeta, openMeta }
 *
 * meta는 rows와 **길이·순서가 같다**(meta[0]은 헤더 행). 각 원소는 { tab, rowNum } —
 * 그 행의 시트 탭과 1-based 시트 행 번호다. 상태 변경·재발송 때 body의 ref로 그대로 넘기면
 * 연락처가 빈 행도 정확히 찾아 쓴다. retreatMeta·openMeta도 같은 규칙.
 */
export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [bookings, retreats, openStays] = await Promise.all([
    getAllBookingsWithMeta(), getAllRetreatsWithMeta(), getAllOpenStaysWithMeta(),
  ]);

  return NextResponse.json({
    rows: bookings.rows,
    retreats: retreats.rows,
    openStays: openStays.rows,
    meta: bookings.meta,
    retreatMeta: retreats.meta,
    openMeta: openStays.meta,
  });
}
