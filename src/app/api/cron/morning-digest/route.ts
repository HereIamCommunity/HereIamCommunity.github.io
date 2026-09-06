import { NextRequest, NextResponse } from "next/server";
import { getAllBookings, getAllRetreats } from "@/lib/sheets";
import { Resend } from "resend";

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL ?? "hereiam.community@gmail.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "코이노니아 <onboarding@resend.dev>";

function getKSTDateStr(offset = 0): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getKSTNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

// 시트에서 읽힌 날짜를 "YYYY-MM-DD"로 정규화
// "2026. 7. 9." / "2026-07-09" / "2026/7/9" 등 모두 처리
function normalizeDate(s: string): string {
  if (!s) return "";
  // 이미 ISO 형식이면 그대로
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // "2026. 7. 9." 또는 "2026.7.9" 형식
  const m = s.match(/(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  // Vercel Cron 인증
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const [bookingRows, retreatRows] = await Promise.all([
      getAllBookings(),
      getAllRetreats(),
    ]);

    const today = getKSTDateStr(0);
    const yesterday = getKSTDateStr(-1);
    const now = getKSTNow();

    const bookings = bookingRows.slice(1); // 헤더 제외
    const retreats = retreatRows.slice(1);

    // ── 오늘 체크인 ──────────────────────────────
    const checkIns = bookings.filter(
      (r) => r[1] === "스테이" && normalizeDate(r[8]) === today && r[13] !== "취소"
    );

    // ── 오늘 체크아웃 ─────────────────────────────
    const checkOuts = bookings.filter(
      (r) => r[1] === "스테이" && normalizeDate(r[9]) === today && r[13] !== "취소"
    );

    // ── 오늘 살롱 방문자 ──────────────────────────
    // row[5] = 일시 (날짜 포함 텍스트)
    const salonToday = bookings.filter(
      (r) => r[1] === "살롱" && normalizeDate(r[5]) === today && r[13] !== "취소"
    );

    // ── 어제 신규 신청 ────────────────────────────
    // row[0] = 신청일시 "2026. 7. 1. 오전 10:00:00"
    function parseRowDate(s: string): Date | null {
      const m = s?.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}):(\d{2})/);
      if (!m) return null;
      let h = parseInt(m[5]);
      if (m[4] === "오후" && h < 12) h += 12;
      if (m[4] === "오전" && h === 12) h = 0;
      return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), h, parseInt(m[6]), parseInt(m[7]));
    }

    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const yesterdayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const newBookings = bookings.filter((r) => {
      const d = parseRowDate(r[0]);
      return d && d >= yesterdayStart && d < yesterdayEnd;
    });

    const newRetreats = retreats.filter((r) => {
      const d = parseRowDate(r[0]);
      return d && d >= yesterdayStart && d < yesterdayEnd;
    });

    // ── 리트릿 회차별 현황 ────────────────────────
    const SESSION_LABELS: Record<string, string> = {
      s1: "1회차 7/3-5",
      s2: "2회차 7/24-26",
      s3: "3회차 7/30-8/1",
      s4: "4회차 8/15-17",
      s5: "5회차 8/21-23",
    };
    const retreatCounts: Record<string, number> = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
    retreats.forEach((r) => {
      if (r[12] === "취소") return;
      for (const [sid, label] of Object.entries(SESSION_LABELS)) {
        if (r[5]?.includes(label.split(" ")[0])) retreatCounts[sid]++;
      }
    });

    // ── HTML 이메일 ───────────────────────────────
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const todayLabel = `${today} (${weekdays[now.getDay()]})`;

    function bookingRow(row: string[], type: "stay" | "salon") {
      if (type === "stay") {
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#372a14">${row[2]}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280">${row[6]}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280">${row[8]} → ${row[9]}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">
            <span style="background:${row[13]==="입금확인"?"#dcfce7":"#fef9c3"};color:${row[13]==="입금확인"?"#166534":"#854d0e"};padding:2px 8px;border-radius:99px;font-size:12px">${row[13]||"신청"}</span>
          </td>
        </tr>`;
      }
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#372a14">${row[2]}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280" colspan="2">${row[4]}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">
          <span style="background:${row[13]==="입금확인"?"#dcfce7":"#fef9c3"};color:${row[13]==="입금확인"?"#166534":"#854d0e"};padding:2px 8px;border-radius:99px;font-size:12px">${row[13]||"신청"}</span>
        </td>
      </tr>`;
    }

    function section(title: string, color: string, content: string) {
      return `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="width:10px;height:10px;border-radius:50%;background:${color}"></div>
            <p style="margin:0;font-size:13px;font-weight:600;color:#372a14">${title}</p>
          </div>
          ${content}
        </div>`;
    }

    const noItem = `<p style="font-size:13px;color:#9ca3af;margin:0;padding:8px 0">없음</p>`;

    const tableWrap = (rows: string[]) =>
      rows.length === 0
        ? noItem
        : `<table style="width:100%;border-collapse:collapse;font-size:13px">${rows.join("")}</table>`;

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <div style="background:#372a14;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
          <p style="margin:0;font-size:11px;opacity:.5;letter-spacing:.15em">KOINONIA · 일일 리포트</p>
          <h2 style="margin:8px 0 0;font-weight:300;font-size:20px">오늘의 코이노니아</h2>
          <p style="margin:4px 0 0;opacity:.6;font-size:13px">${todayLabel}</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">

          ${section(
            `오늘 체크인 (${checkIns.length}명)`,
            "#296973",
            tableWrap(checkIns.map((r) => bookingRow(r, "stay")))
          )}

          ${section(
            `오늘 체크아웃 (${checkOuts.length}명)`,
            "#6b7280",
            tableWrap(checkOuts.map((r) => bookingRow(r, "stay")))
          )}

          ${section(
            `오늘 살롱 방문 (${salonToday.length}명)`,
            "#ff6b35",
            tableWrap(salonToday.map((r) => bookingRow(r, "salon")))
          )}

          ${section(
            `어제 신규 신청 (${newBookings.length + newRetreats.length}건)`,
            "#f59e0b",
            newBookings.length === 0 && newRetreats.length === 0
              ? noItem
              : `
                ${newBookings.length > 0 ? tableWrap(newBookings.map((r) => bookingRow(r, r[1] === "스테이" ? "stay" : "salon"))) : ""}
                ${newRetreats.length > 0 ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 4px">썸머캠프 신규 신청: ${newRetreats.map(r=>r[1]).join(", ")}</p>` : ""}
              `
          )}

          ${section(
            "썸머캠프 신청 현황",
            "#8b5cf6",
            `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:4px">
              ${Object.entries(SESSION_LABELS).map(([sid, label]) => {
                const cnt = retreatCounts[sid];
                const full = cnt >= 6;
                return `<div style="text-align:center;padding:10px 6px;background:${full?"#fef2f2":"#f8fafc"};border-radius:10px;border:1px solid ${full?"#fca5a5":"#e5e7eb"}">
                  <p style="margin:0;font-size:10px;color:#6b7280">${label}</p>
                  <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${full?"#ef4444":"#372a14"}">${cnt}<span style="font-size:11px;font-weight:400;color:#9ca3af">/6</span></p>
                  ${full ? `<p style="margin:2px 0 0;font-size:10px;color:#ef4444">마감</p>` : ""}
                </div>`;
              }).join("")}
            </div>`
          )}

          <p style="font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;margin:0">
            코이노니아 어드민에서 자세한 내용을 확인하세요 →
            <a href="https://koinonia-web.vercel.app/admin" style="color:#ff6b35">어드민 바로가기</a>
          </p>
        </div>
      </div>`;

    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    if (!resend) {
      return NextResponse.json({ ok: false, message: "RESEND_API_KEY 미설정" });
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: [OPERATOR_EMAIL],
      subject: `[코이노니아] ${todayLabel} 오늘의 리포트`,
      html,
    });

    return NextResponse.json({
      ok: true,
      today,
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
      salonToday: salonToday.length,
      newBookings: newBookings.length + newRetreats.length,
    });
  } catch (err) {
    console.error("[CRON morning-digest]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
