import { NextRequest, NextResponse } from "next/server";
import { appendRetreat, getRetreatCounts } from "@/lib/sheets";
import { sendOperatorAlert, sendRetreatConfirmation } from "@/lib/email";

const MAX_PER_SESSION = 6;

/** GET — 회차별 현재 신청 인원 반환 */
export async function GET() {
  try {
    const counts = await getRetreatCounts();
    return NextResponse.json({ counts });
  } catch (err) {
    console.error("[RETREAT GET]", err);
    return NextResponse.json({ counts: { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 } });
  }
}

/** POST — 리트릿 신청 저장 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, phone, email, grade, region, session, referral, question, memo, allergy, care, parentNote } = data;

    if (!name || !phone || !grade || !session) {
      return NextResponse.json({ success: false, message: "필수 항목을 입력해주세요." }, { status: 400 });
    }

    // 마감 여부 재확인
    const counts = await getRetreatCounts();
    if ((counts[session] ?? 0) >= MAX_PER_SESSION) {
      return NextResponse.json({ success: false, message: "해당 회차가 마감됐어요." }, { status: 409 });
    }

    const createdAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    const SESSION_LABELS: Record<string, string> = {
      s1: "1회차 — 7월 3-5일 (금토일)",
      s2: "2회차 — 7월 24-26일 (금토일)",
      s3: "3회차 — 7월 30일-8월 1일 (목금토)",
      s4: "4회차 — 8월 15-17일 (토일월)",
      s5: "5회차 — 8월 21-23일 (금토일)",
    };

    await appendRetreat({
      createdAt,
      name,
      phone,
      grade,
      region: region ?? "",
      session,
      referral: referral ?? "",
      question: question ?? "",
      memo: memo ?? "",
      allergy: allergy ?? "",
      care: care ?? "",
      parentNote: parentNote ?? "",
      status: "신청",
    });

    // 운영자 이메일 알림
    try {
      await sendOperatorAlert({
        type: "salon" as const,
        name,
        phone,
        program: `[리트릿] ${SESSION_LABELS[session] ?? session}`,
        date: `학년: ${grade} / 지역: ${region ?? "-"} / 추천인: ${referral ?? "-"}`,
        totalAmount: 440000,
        memo: [question, memo].filter(Boolean).join(" | "),
      });
    } catch (e) {
      console.warn("[RETREAT] 운영자 이메일 전송 실패:", e);
    }

    // 신청자 확인 이메일
    try {
      await sendRetreatConfirmation({
        name,
        email: email ?? undefined,
        session: SESSION_LABELS[session] ?? session,
        totalAmount: 440000,
      });
    } catch (e) {
      console.warn("[RETREAT] 신청자 이메일 전송 실패:", e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[RETREAT POST]", err);
    return NextResponse.json({ success: false, message: "서버 오류가 발생했어요." }, { status: 500 });
  }
}
