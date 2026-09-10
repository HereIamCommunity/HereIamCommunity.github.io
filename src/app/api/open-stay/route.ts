import { NextRequest, NextResponse } from "next/server";
import { appendOpenStay } from "@/lib/sheets";
import { Resend } from "resend";
import { postSlack } from "@/lib/slack";
import { buildSimpleBlocks } from "@/lib/slack-blocks";

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL ?? "hereiam.community@gmail.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "코이노니아 <onboarding@resend.dev>";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, phone, email, checkIn, checkOut, groupType, groupSize, reason, contribution, message } = data;

    if (!name || !phone || !checkIn || !checkOut || !groupType || !contribution?.length) {
      return NextResponse.json({ success: false, message: "필수 항목을 입력해주세요." }, { status: 400 });
    }

    const createdAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    const GROUP_LABELS: Record<string, string> = {
      solo: "혼자", duo: "둘이", family: "가족", team: "팀/모임",
    };

    await appendOpenStay({
      createdAt, name, phone, email: email ?? "",
      checkIn, checkOut,
      groupType: GROUP_LABELS[groupType] ?? groupType,
      groupSize: groupSize ? String(groupSize) : (groupType === "solo" ? "1" : ""),
      reason: reason ?? "",
      contribution: Array.isArray(contribution) ? contribution.join(", ") : contribution,
      message: message ?? "",
      status: "신청",
    });

    const contributionLabel = Array.isArray(contribution) ? contribution.join(" · ") : contribution;
    const groupLabel = GROUP_LABELS[groupType] ?? groupType;
    const groupDisplay = groupType === "solo" ? "혼자 (1명)" : `${groupLabel} · ${groupSize || "?"}명`;

    // 운영자 슬랙 알림 — 실패해도 신청 처리는 그대로 끝낸다.
    try {
      await postSlack(
        buildSimpleBlocks(
          "🚪 무료개방 신청",
          [
            { label: "이름", value: name },
            { label: "연락처", value: phone },
            { label: "방문 형태", value: groupDisplay },
            { label: "일정", value: `${checkIn} ~ ${checkOut}` },
            { label: "기여 방법", value: contributionLabel || "-" },
          ],
          "어드민 무료개방 탭에서 확인해주세요."
        )
      );
    } catch (e) {
      console.warn("[OPEN-STAY] 슬랙 알림 실패:", e);
    }

    // 운영자 알림
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    if (resend) {
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="background:#372a14;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
            <p style="margin:0;font-size:11px;opacity:.5;letter-spacing:.15em">KOINONIA · 무료 개방 신청</p>
            <h2 style="margin:8px 0 0;font-weight:300;font-size:20px">새 무료 개방 신청이 들어왔어요</h2>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:7px 0;color:#6b7280;width:90px">이름</td><td style="padding:7px 0;font-weight:600;color:#372a14">${name}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">연락처</td><td style="padding:7px 0;font-weight:600">${phone}</td></tr>
              ${email ? `<tr><td style="padding:7px 0;color:#6b7280">이메일</td><td style="padding:7px 0">${email}</td></tr>` : ""}
              <tr><td style="padding:7px 0;color:#6b7280">방문 형태</td><td style="padding:7px 0;font-weight:600;color:#296973">${groupDisplay}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">체크인</td><td style="padding:7px 0;font-weight:600;color:#296973">${checkIn}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">체크아웃</td><td style="padding:7px 0;font-weight:600;color:#296973">${checkOut}</td></tr>
              <tr><td style="padding:7px 0;color:#6b7280">기여 방법</td><td style="padding:7px 0;font-weight:600;color:#ff6b35">${contributionLabel}</td></tr>
              ${reason ? `<tr><td style="padding:7px 0;color:#6b7280">방문 이유</td><td style="padding:7px 0;color:#374151">${reason}</td></tr>` : ""}
              ${message ? `<tr><td style="padding:7px 0;color:#6b7280">응원 메시지</td><td style="padding:7px 0;color:#374151;font-style:italic">"${message}"</td></tr>` : ""}
            </table>
            <div style="margin-top:20px;padding:12px 16px;background:#fff7ed;border-radius:8px;font-size:12px;color:#92400e">
              일정과 사유 확인 후 확정 메일을 직접 보내주세요.
            </div>
          </div>
        </div>`;

      await resend.emails.send({
        from: FROM_EMAIL,
        to: [OPERATOR_EMAIL],
        subject: `[코이노니아] 무료 개방 신청 — ${name} (${checkIn} ~ ${checkOut})`,
        html,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[OPEN-STAY]", err);
    return NextResponse.json({ success: false, message: "서버 오류가 발생했어요." }, { status: 500 });
  }
}
