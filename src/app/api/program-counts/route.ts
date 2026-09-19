import { NextResponse } from "next/server";
import { getAllBookings } from "@/lib/store";

/** 살롱 프로그램별 신청 인원 (취소 제외) */
export async function GET() {
  try {
    const rows = await getAllBookings();
    const counts: Record<string, number> = {};

    for (const row of rows) {
      if (!row[0] || row[0] === "신청일시") continue;
      if (row[1] !== "살롱") continue;
      const status = row[13] ?? "";
      if (status === "취소") continue;
      const program = row[4] ?? "";
      if (!program) continue;
      counts[program] = (counts[program] ?? 0) + 1;
    }

    return NextResponse.json({ counts });
  } catch (e) {
    console.error("[program-counts]", e);
    return NextResponse.json({ counts: {} });
  }
}
