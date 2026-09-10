/**
 * 호스트(운영자) 알림 경로 선택 — 슬랙 우선, 실패·미설정이면 기존 문자.
 *
 * 게스트 경로는 여기서 다루지 않는다. `sendBookingMessages`의 호스트 분기만 이 함수를 쓴다.
 *
 * 문자 발송은 호출부가 `sendSms` 콜백으로 주입한다(솔라피 클라이언트를 이 파일이 만들지 않는다).
 * 콜백이 없다는 건 보낼 호스트 번호가 없다는 뜻이라 `channel: "none"`으로 끝난다.
 */

import { postSlack } from "@/lib/slack";
import { buildHostBlocks } from "@/lib/slack-blocks";
import type { Booking, BookingEvent, HostContext, SendResult } from "@/lib/kakao";

export type HostChannel = "slack" | "sms" | "none";

export type HostNotifyResult = { result: SendResult; channel: HostChannel };

/** 문자 대체 발송. 실제 발송은 호출부(kakao.ts)가 쥔다. */
export type HostSmsSender = () => Promise<SendResult>;

export async function notifyHost(
  event: BookingEvent,
  booking: Booking,
  ctx: HostContext = {},
  sendSms?: HostSmsSender
): Promise<HostNotifyResult> {
  const slack = await postSlack(buildHostBlocks(event, booking, ctx));
  if (slack.ok) return { result: "ok", channel: "slack" };

  // 미설정은 정상 경로(문자 유지)라 경고만, 실제 실패는 오류로 남긴다 — 채널 설정 문제를 로그에서 찾을 수 있게.
  if (slack.error === "not-configured") {
    console.warn("[SLACK] 미설정 — 호스트는 문자로 보냅니다");
  } else {
    console.error(`[SLACK] 발송 실패(${slack.error}) — 호스트 문자로 대체합니다`);
  }

  if (!sendSms) return { result: "skipped", channel: "none" };
  return { result: await sendSms(), channel: "sms" };
}
