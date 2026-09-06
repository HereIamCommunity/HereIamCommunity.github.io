import { NextRequest, NextResponse } from "next/server";
import { buildGuestMessage, buildHostMessage, sendBookingMessages, type Booking } from "@/lib/kakao";

/**
 * 알림 연결 테스트.
 * 환경변수를 점검하고, 호스트 번호로 샘플 'received' 메시지를 실제 발송한 뒤
 * 솔라피 응답을 그대로 돌려준다.
 */

const REQUIRED = [
  "SOLAPI_API_KEY",
  "SOLAPI_API_SECRET",
  "SOLAPI_SENDER_PHONE",
  "OPERATOR_PHONE",
];

const KAKAO_ENV = [
  "KAKAO_PFID",
  "KAKAO_TEMPLATE_SALON_RECEIVED",
  "KAKAO_TEMPLATE_STAY_RECEIVED",
  "KAKAO_TEMPLATE_SALON_CONFIRMED",
  "KAKAO_TEMPLATE_STAY_CONFIRMED",
  "KAKAO_TEMPLATE_CANCELLED",
  "KAKAO_TEMPLATE_HOST",
];

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const missingRequired = REQUIRED.filter((k) => !process.env[k]);
  const missingKakao = KAKAO_ENV.filter((k) => !process.env[k]);

  if (missingRequired.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "필수 환경변수가 비어 있습니다.",
        missingRequired,
        missingKakao,
      },
      { status: 400 }
    );
  }

  // 샘플: 호스트 메시지 한 통만 호스트 번호로 발송
  const sample: Booking = {
    type: "salon",
    createdAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    name: "테스트",
    phone: process.env.OPERATOR_PHONE!,
    program: "알림 연결 테스트",
    date: new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }),
    discount: "none",
    totalAmount: 0,
  };

  const result = await sendBookingMessages("received", sample, { hostOnly: true });

  return NextResponse.json({
    ok: result.host === "ok",
    missingKakao,
    kakaoMode: missingKakao.length === 0 ? "알림톡(문자 대체)" : "문자만 (템플릿 env 미설정)",
    sentTo: process.env.OPERATOR_PHONE,
    result,
    preview: {
      guest: buildGuestMessage("received", sample).text,
      host: buildHostMessage("received", sample).text,
    },
  });
}
