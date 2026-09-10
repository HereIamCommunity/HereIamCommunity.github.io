/**
 * 슬랙 Block Kit 조립 — 순수 함수만. 네트워크·환경변수를 보지 않는다.
 *
 * 구성 (docs/admin-ux-design.md 8장):
 *   header  이모지 + 이벤트 이름 · 구분(살롱/스테이)
 *   section 이름 · 연락처 · 내용 · 일시 · 금액  (연락처는 tel 링크 없이 텍스트)
 *   context 게스트 알림 결과 + 호스트가 다음에 할 일
 *   actions 어드민 열기 버튼
 *
 * fallback(`text`)은 기존 호스트 문자 본문(buildHostMessage)을 그대로 쓴다 —
 * 슬랙 푸시 미리보기와 문자 대체본이 같은 문장이어야 헷갈리지 않는다.
 */

import {
  buildHostMessage,
  hostEventLabel,
  typeLabel,
  won,
  type Booking,
  type BookingEvent,
  type HostContext,
} from "@/lib/kakao";
import type { SlackBlock, SlackMessage } from "@/lib/slack";

const ADMIN_LINK = "https://koinonia-web.vercel.app/admin?tab=list";

const EVENT_EMOJI: Record<BookingEvent, string> = {
  received: "🆕",
  confirmed: "✅",
  cancelled: "❌",
};

export type SlackField = { label: string; value: string };

/**
 * 슬랙 mrkdwn 이스케이프. 시트에서 온 자유 입력(이름·프로그램·사유)에 `&`·`<`·`>`가 있으면
 * 슬랙이 링크/엔티티로 파싱해 깨진다 (api.slack.com/reference/surfaces/formatting#escaping).
 * 문자 대체본(`text`)에는 적용하지 않는다 — 그건 문자로 나가는 원문이다.
 */
export function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function header(text: string): SlackBlock {
  return { type: "header", text: { type: "plain_text", text, emoji: true } };
}

function fieldSection(fields: SlackField[]): SlackBlock {
  return {
    type: "section",
    // 슬랙 section fields는 최대 10개다. 넘치면 잘라 보낸다(발송 자체가 막히지 않도록).
    fields: fields.slice(0, 10).map((f) => ({ type: "mrkdwn", text: `*${escapeMrkdwn(f.label)}*\n${escapeMrkdwn(f.value)}` })),
  };
}

function context(texts: string[]): SlackBlock {
  return { type: "context", elements: texts.map((text) => ({ type: "mrkdwn", text })) };
}

function adminButton(): SlackBlock {
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "어드민 열기", emoji: true },
        url: ADMIN_LINK,
      },
    ],
  };
}

/** 이벤트별 이모지. 카드결제로 확정된 건만 💳로 구분한다. */
export function hostEventEmoji(event: BookingEvent, booking: Booking): string {
  if (event === "confirmed" && booking.via === "toss") return "💳";
  return EVENT_EMOJI[event];
}

function contentField(b: Booking): SlackField {
  return { label: "내용", value: (b.type === "salon" ? b.program : b.room) || "-" };
}

function whenField(b: Booking): SlackField {
  if (b.type === "salon") return { label: "일시", value: b.date || "-" };
  const nights = b.nights ? ` (${b.nights}박)` : "";
  return { label: "일시", value: `${b.checkIn || "-"} ~ ${b.checkOut || "-"}${nights}` };
}

function amountField(event: BookingEvent, b: Booking): SlackField {
  const amount = `${won(b.totalAmount)}원`;
  if (event === "received") return { label: "금액", value: `${amount} · 입금 대기` };
  if (event === "confirmed") {
    return {
      label: "금액",
      value: `${amount} · ${b.via === "toss" ? "카드결제 완료" : "입금 확인"}`,
    };
  }
  return { label: "금액", value: amount };
}

/** 게스트 알림 결과 한 줄. 실패면 굵게 강조해서 재발송을 요구한다. */
function guestLine(ctx: HostContext): string | null {
  const guest = ctx.guestResult;
  if (guest === undefined) return null;
  if (guest === "ok") return "게스트에게 안내 알림톡을 보냈어요.";
  if (guest === "skipped") {
    return `게스트 알림은 아직 발송되지 않았어요 (${escapeMrkdwn(ctx.guestSkipReason ?? "템플릿 미설정")}).`;
  }
  return `*⚠ 게스트 알림 실패 — ${escapeMrkdwn(guest.error.replace(/\.$/, ""))} · 어드민에서 재발송*`;
}

/** 호스트가 다음에 할 일. 확정 건은 할 일이 없다. */
function nextLine(event: BookingEvent): string | null {
  if (event === "received") return "입금이 확인되면 어드민에서 '입금확인'을 눌러주세요.";
  if (event === "cancelled") return "이미 입금된 건이면 환불 처리가 필요해요.";
  return null;
}

/** 예약 이벤트(접수·확정·취소) 호스트 알림 블록. */
export function buildHostBlocks(
  event: BookingEvent,
  booking: Booking,
  ctx: HostContext = {}
): SlackMessage {
  const notes = [guestLine(ctx), nextLine(event)].filter((x): x is string => !!x);

  const blocks: SlackBlock[] = [
    header(`${hostEventEmoji(event, booking)} ${hostEventLabel(event, booking)} · ${typeLabel(booking)}`),
    fieldSection([
      { label: "이름", value: booking.name || "-" },
      { label: "연락처", value: booking.phone || "-" },
      contentField(booking),
      whenField(booking),
      amountField(event, booking),
    ]),
    ...(notes.length > 0 ? [context(notes)] : []),
    adminButton(),
  ];

  return { blocks, text: buildHostMessage(event, booking, ctx).text };
}

/** 리트릿·무료개방·일괄 처리처럼 예약이 아닌 알림용 단순 블록. */
export function buildSimpleBlocks(
  title: string,
  fields: SlackField[],
  note?: string
): SlackMessage {
  const blocks: SlackBlock[] = [
    header(title),
    fieldSection(fields),
    ...(note ? [context([escapeMrkdwn(note)])] : []),
  ];

  const text = [title, ...fields.map((f) => `${f.label}: ${f.value}`), ...(note ? [note] : [])].join(
    "\n"
  );

  return { blocks, text };
}
