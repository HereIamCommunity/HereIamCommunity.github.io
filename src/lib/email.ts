import { Resend } from "resend";

const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL ?? "koinonia2026@naver.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "코이노니아 <onboarding@resend.dev>";

export type BookingData = {
  type: "salon" | "stay";
  name: string;
  phone: string;
  email?: string;
  program?: string;
  date?: string;
  room?: string;
  nights?: number;
  checkIn?: string;
  checkOut?: string;
  discount?: string;
  totalAmount: number;
  memo?: string;
};

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

/* ─── 운영자 알림 ─────────────────────────────── */
export async function sendOperatorAlert(data: BookingData) {
  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY 미설정 — 이메일 발송 건너뜀");
    return;
  }

  const typeLabel = data.type === "salon" ? "살롱" : "스테이";
  const subject = `[코이노니아] 새 ${typeLabel} 신청 — ${data.name}`;

  const details =
    data.type === "salon"
      ? `프로그램: ${data.program ?? "-"}\n일시: ${data.date ?? "-"}`
      : `객실: ${data.room ?? "-"}\n체크인: ${data.checkIn} → 체크아웃: ${data.checkOut} (${data.nights}박)`;

  const discountLabel =
    data.discount === "geot" ? "멤버십 '곁' 무료/할인"
    : data.discount === "nagnae" ? "나그네방 후원자 30% 할인"
    : "없음";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#372a14;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
        <p style="margin:0;font-size:12px;opacity:.6;letter-spacing:.1em">KOINONIA · ${typeLabel.toUpperCase()}</p>
        <h2 style="margin:8px 0 0;font-weight:400;font-size:20px">새 참가 신청이 들어왔어요</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#6b7280;width:80px">이름</td><td style="padding:8px 0;font-weight:600;color:#372a14">${data.name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">연락처</td><td style="padding:8px 0;font-weight:600">${data.phone}</td></tr>
          ${data.email ? `<tr><td style="padding:8px 0;color:#6b7280">이메일</td><td style="padding:8px 0">${data.email}</td></tr>` : ""}
          ${details.split("\n").map(line => {
            const idx = line.indexOf(": ");
            const k = line.slice(0, idx);
            const v = line.slice(idx + 2);
            return `<tr><td style="padding:8px 0;color:#6b7280">${k}</td><td style="padding:8px 0;font-weight:600;color:#372a14">${v}</td></tr>`;
          }).join("")}
          <tr><td style="padding:8px 0;color:#6b7280">할인</td><td style="padding:8px 0">${discountLabel}</td></tr>
          <tr style="border-top:1px solid #f3f4f6">
            <td style="padding:12px 0 0;color:#6b7280">입금액</td>
            <td style="padding:12px 0 0;font-weight:700;font-size:18px;color:#ff6b35">${data.totalAmount.toLocaleString()}원</td>
          </tr>
          ${data.memo ? `<tr><td style="padding:8px 0;color:#6b7280">요청사항</td><td style="padding:8px 0;color:#374151">${data.memo}</td></tr>` : ""}
        </table>
        <div style="margin-top:20px;padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#166534">
          입금 확인 후 상태를 '입금확인'으로 변경해주세요.
        </div>
      </div>
    </div>`;

  await resend.emails.send({ from: FROM_EMAIL, to: [OPERATOR_EMAIL], subject, html });
}

/* ─── 신청자 확인 메일 ─────────────────────────── */
export async function sendGuestConfirmation(data: BookingData) {
  const resend = getResend();
  if (!resend || !data.email) return;

  const typeLabel = data.type === "salon" ? "살롱" : "스테이";
  const isMember = data.discount === "geot";
  const subject = `[코이노니아] ${typeLabel} 신청이 접수됐어요, ${data.name}님 🌿`;

  const detailRows =
    data.type === "salon"
      ? `<tr><td style="padding:8px 0;color:#6b7280;width:80px">프로그램</td><td style="padding:8px 0;font-weight:600;color:#372a14">${data.program ?? "-"}</td></tr>
         <tr><td style="padding:8px 0;color:#6b7280">일시</td><td style="padding:8px 0;font-weight:600;color:#372a14">${data.date ?? "-"}</td></tr>`
      : `<tr><td style="padding:8px 0;color:#6b7280;width:80px">객실</td><td style="padding:8px 0;font-weight:600;color:#372a14">${data.room ?? "-"}</td></tr>
         <tr><td style="padding:8px 0;color:#6b7280">체크인</td><td style="padding:8px 0;font-weight:600;color:#372a14">${data.checkIn}</td></tr>
         <tr><td style="padding:8px 0;color:#6b7280">체크아웃</td><td style="padding:8px 0;font-weight:600;color:#372a14">${data.checkOut} (${data.nights}박)</td></tr>`;

  const paymentBlock = isMember && data.type === "salon"
    ? `<div style="background:#f0fdf4;padding:16px;border-radius:10px;font-size:14px;color:#166534;margin-top:16px">
         ✅ 멤버십 '곁' 혜택으로 무료 참가입니다. 당일 코이노니아에서 만나요!
       </div>`
    : `<div style="background:#fffbde;padding:16px;border-radius:10px;font-size:14px;color:#92400e;margin-top:16px">
         <p style="margin:0 0 8px;font-weight:600">입금 계좌 안내</p>
         <p style="margin:0;font-size:15px">하나은행 <strong>5539-10-13844507</strong> (코이노니아)</p>
         <p style="margin:4px 0 0">입금자명: <strong>${data.name}</strong> / 금액: <strong>${data.totalAmount.toLocaleString()}원</strong></p>
       </div>`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#372a14;color:white;padding:24px;border-radius:12px 12px 0 0">
        <p style="margin:0;font-size:11px;opacity:.5;letter-spacing:.15em">KOINONIA · ANDONG</p>
        <h2 style="margin:10px 0 4px;font-weight:300;font-size:22px">신청이 접수됐어요</h2>
        <p style="margin:0;opacity:.7;font-size:14px">${data.name}님, 코이노니아에서 만나요 🌿</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
        <p style="font-size:13px;color:#6b7280;margin:0 0 16px">신청 내역을 확인해주세요.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${detailRows}
          <tr style="border-top:1px solid #f3f4f6">
            <td style="padding:12px 0 0;color:#6b7280">결제금액</td>
            <td style="padding:12px 0 0;font-weight:700;font-size:17px;color:#ff6b35">${data.totalAmount === 0 ? "무료" : `${data.totalAmount.toLocaleString()}원`}</td>
          </tr>
        </table>
        ${paymentBlock}
        <p style="font-size:12px;color:#9ca3af;margin-top:20px">
          문의는 인스타그램 <a href="https://instagram.com/koinonia_andong" style="color:#ff6b35">@koinonia_andong</a>으로 연락주세요.
        </p>
      </div>
      <p style="font-size:11px;color:#d1d5db;text-align:center;margin-top:16px">
        경북 안동시 중앙로 57 · koinonia-web.vercel.app
      </p>
    </div>`;

  await resend.emails.send({ from: FROM_EMAIL, to: [data.email], subject, html });
}

/* ─── 리트릿 신청자 확인 메일 ───────────────────── */
export async function sendRetreatConfirmation({
  name, email, session, totalAmount,
}: {
  name: string;
  email?: string;
  session: string;
  totalAmount: number;
}) {
  const resend = getResend();
  if (!resend || !email) return;

  const subject = `[코이노니아] 72시간 썸머캠프 신청이 접수됐어요 🌿`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <div style="background:#372a14;color:white;padding:24px;border-radius:12px 12px 0 0">
        <p style="margin:0;font-size:11px;opacity:.5;letter-spacing:.15em">KOINONIA · 72시간 썸머캠프</p>
        <h2 style="margin:10px 0 4px;font-weight:300;font-size:22px">신청이 접수됐어요</h2>
        <p style="margin:0;opacity:.7;font-size:14px">${name} 친구와 부모님, 코이노니아입니다.</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 12px 12px">

        <p style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 20px">
          새로운 환경에서 친구를 사귀는 72시간 썸머캠프에 신청해 주셔서 감사합니다.<br />
          <strong>${name}</strong>에게 뜻깊은 여름 방학의 추억이 될 수 있도록 최선을 다해 준비하고 있습니다.
        </p>

        <div style="background:#faf9f7;border-radius:10px;padding:16px 20px;font-size:14px;margin-bottom:20px">
          <p style="margin:0 0 10px;font-weight:600;color:#372a14">신청 내역</p>
          <table style="width:100%;border-collapse:collapse;color:#374151">
            <tr>
              <td style="padding:5px 0;color:#6b7280;width:80px">회차</td>
              <td style="padding:5px 0;font-weight:600;color:#372a14">${session}</td>
            </tr>
            <tr>
              <td style="padding:5px 0;color:#6b7280">참가비</td>
              <td style="padding:5px 0;font-weight:700;color:#ff6b35">${totalAmount.toLocaleString()}원</td>
            </tr>
          </table>
        </div>

        <div style="background:#fffbde;padding:16px 20px;border-radius:10px;font-size:14px;color:#92400e;margin-bottom:20px">
          <p style="margin:0 0 8px;font-weight:600">입금 계좌 안내</p>
          <p style="margin:0;font-size:15px">하나은행 <strong>5539-10-13844507</strong> (코이노니아)</p>
          <p style="margin:6px 0 0">입금자명: <strong>${name}</strong> / 금액: <strong>${totalAmount.toLocaleString()}원</strong></p>
        </div>

        <p style="font-size:14px;color:#6b7280;line-height:1.8;margin:0 0 24px">
          캠프 준비물 및 참여 안내 사항은 캠프 일주일 전에 다시 한 번 메시지 드릴 예정입니다. 감사합니다.
        </p>

        <p style="font-size:14px;color:#372a14;font-weight:500;margin:0 0 20px">
          코이노니아 하영, 예빈 드림
        </p>

        <p style="font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;margin:0">
          문의는 인스타그램 <a href="https://instagram.com/koinonia_andong" style="color:#ff6b35">@koinonia_andong</a>으로 연락주세요.<br />
          경북 안동시 중앙로 57 · koinonia-web.vercel.app
        </p>
      </div>
    </div>`;

  await resend.emails.send({ from: FROM_EMAIL, to: [email], subject, html });
}
