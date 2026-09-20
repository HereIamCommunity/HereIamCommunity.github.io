import { NextResponse } from "next/server";
import { getSalonCounts } from "@/lib/sheets";

/** 신청 폼의 잔여 표시용 — '프로그램 + 일시' 별 신청 인원. */
export async function GET() {
  const counts = await getSalonCounts();
  return NextResponse.json({ counts });
}
