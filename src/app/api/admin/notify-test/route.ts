import { NextRequest, NextResponse } from "next/server";
import { buildGuestMessage, buildHostMessage, sendBookingMessages, type Booking } from "@/lib/kakao";
import { isSlackConfigured, postSlack, slackChannelId } from "@/lib/slack";
import { buildSimpleBlocks } from "@/lib/slack-blocks";

/**
 * 알림 연결 테스트.
 * GET  — 발송 없이 환경변수만 점검한다 (어드민 설정 탭이 진입할 때마다 호출).
 * POST — 호스트 번호로 샘플 'received' 메시지를 실제 발송하고 솔라피 응답을 돌려준다.
 *        body `{ target: "slack" }`이면 슬랙 채널에만 테스트 1건을 보내고 문자는 보내지 않는다.
 */

const REQUIRED = [
  "SOLAPI_API_KEY",
  "SOLAPI_API_SECRET",
  "SOLAPI_SENDER_PHONE",
  "OPERATOR_PHONE",
];

// 솔라피에 등록된 템플릿 8개 (docs/alimtalk-templates.md).
// KAKAO_TEMPLATE_HOST는 선택이라 뺀다. 채널 pfId는 아래에서 따로 본다.
const KAKAO_ENV = [
  "KAKAO_TEMPLATE_SALON_RECEIVED",
  "KAKAO_TEMPLATE_SALON_CONFIRMED",
  "KAKAO_TEMPLATE_SALON_CANCELLED",
  "KAKAO_TEMPLATE_STAY_RECEIVED",
  "KAKAO_TEMPLATE_STAY_CONFIRMED",
  "KAKAO_TEMPLATE_STAY_CANCELLED",
  "KAKAO_TEMPLATE_STAY_REMINDER",
  "KAKAO_TEMPLATE_STAY_CHECKOUT",
];

/** 010-1234-5678 → 010-****-5678 (설정 탭에 그대로 보여준다) */
function maskPhone(phone: string | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length < 7) return "*".repeat(d.length);
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

function checkEnv() {
  const missingRequired = REQUIRED.filter((k) => !process.env[k]);
  const missingKakao = ["KAKAO_PFID", ...KAKAO_ENV].filter((k) => !process.env[k]);
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingKakao,
    kakaoMode:
      missingKakao.length === 0
        ? "알림톡 (실패 시 문자 대체)"
        : "게스트 알림톡 발송 안 함 (템플릿 env 미설정) · 호스트에는 문자 발송",
    operatorPhoneMasked: maskPhone(process.env.OPERATOR_PHONE),
    // 슬랙이 설정돼 있으면 호스트 알림이 채널로, 아니면 기존 문자로 나간다.
    slack: { configured: isSlackConfigured(), channel: slackChannelId() },
  };
}

/** 발송 없이 점검만. */
export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(checkEnv());
}

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { target?: unknown };

  // 슬랙 테스트 — 문자는 보내지 않는다(요금 없음). 솔라피 환경변수와 무관하게 동작한다.
  if (body?.target === "slack") {
    if (!isSlackConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          target: "slack",
          error: "슬랙이 설정되지 않았습니다. SLACK_BOT_TOKEN / SLACK_CHANNEL_ID를 확인해주세요.",
          slack: { configured: false, channel: slackChannelId() },
        },
        { status: 400 }
      );
    }

    const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    const sent = await postSlack(
      buildSimpleBlocks(
        "🔔 슬랙 알림 테스트",
        [
          { label: "보낸 곳", value: "어드민 설정 탭" },
          { label: "시각", value: now },
        ],
        "이 메시지가 보이면 호스트 알림이 이 채널로 나갑니다."
      )
    );

    return NextResponse.json(
      {
        ok: sent.ok,
        target: "slack",
        ...(sent.ok ? { ts: sent.ts } : { error: sent.error }),
        slack: { configured: true, channel: slackChannelId() },
      },
      { status: sent.ok ? 200 : 502 }
    );
  }

  const missingRequired = REQUIRED.filter((k) => !process.env[k]);
  const missingKakao = ["KAKAO_PFID", ...KAKAO_ENV].filter((k) => !process.env[k]);

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
    kakaoMode: missingKakao.length === 0
      ? "알림톡 (실패 시 문자 대체)"
      : "게스트 알림톡 발송 안 함 (템플릿 env 미설정) · 호스트에는 문자 발송",
    sentTo: process.env.OPERATOR_PHONE,
    // 슬랙이 설정돼 있으면 호스트 알림은 문자가 아니라 채널로 나간다.
    hostChannel: result.hostChannel ?? "none",
    slack: { configured: isSlackConfigured(), channel: slackChannelId() },
    result,
    preview: {
      guest: buildGuestMessage("received", sample).text,
      host: buildHostMessage("received", sample).text,
    },
  });
}
