/**
 * 카카오 알림톡 + 문자 대체 발송 (Solapi)
 *
 * 본문 상수와 변수 키는 솔라피 등록본(phases/notify/solapi-templates.json)에서 그대로 가져왔다.
 * 문자 대체 문구(text)는 같은 상수를 fill()로 치환해 만들기 때문에 본문과 변수가 어긋날 수 없다.
 * 템플릿을 바꾸면 이 파일의 본문 상수·변수 키도 같이 바꿔야 한다 (docs/alimtalk-templates.md).
 *
 * 환경변수:
 *   SOLAPI_API_KEY / SOLAPI_API_SECRET  — 솔라피 인증
 *   SOLAPI_SENDER_PHONE                 — 등록된 발신번호 (하이픈 없이)
 *   KAKAO_PFID                          — 카카오 채널 pfId
 *   KAKAO_TEMPLATE_SALON_RECEIVED       — 1. [살롱] 신청 접수 시
 *   KAKAO_TEMPLATE_SALON_CONFIRMED      — 2. [살롱] 입금 확인 후
 *   KAKAO_TEMPLATE_SALON_CANCELLED      — 3. [살롱] 취소 시
 *   KAKAO_TEMPLATE_STAY_RECEIVED        — 4. [스테이] 예약 신청 접수 시
 *   KAKAO_TEMPLATE_STAY_CONFIRMED       — 5. [스테이] 입금 확인 후
 *   KAKAO_TEMPLATE_STAY_CANCELLED       — 6. [스테이] 취소 시
 *   KAKAO_TEMPLATE_STAY_REMINDER        — 7. [스테이] 체크인 전날 D-1 (src/lib/notify.ts)
 *   KAKAO_TEMPLATE_STAY_CHECKOUT        — 8. [스테이] 체크아웃 당일 (src/lib/notify.ts)
 *   KAKAO_TEMPLATE_HOST                 — 호스트 알림 (선택. 없으면 호스트는 문자)
 *   OPERATOR_PHONE                      — 호스트 수신번호
 */

import { SolapiMessageService } from "solapi";
import { isPastBooking } from "@/lib/past-booking";
import { notifyHost, type HostChannel } from "@/lib/host-notify";
import {
  TEXT_SALON_RECEIVED,
  TEXT_SALON_CONFIRMED,
  TEXT_SALON_CANCELLED,
  TEXT_STAY_RECEIVED,
  TEXT_STAY_CONFIRMED,
  TEXT_STAY_CANCELLED,
} from "@/lib/kakao-texts";

const ADMIN_URL = "koinonia-web.vercel.app/admin";

/* ─── 등록본 본문 템플릿 ID ──── */
// 1. [살롱] 신청 접수 시 · KA01TP260906111616282uwVQwrob8OX
// 2. [살롱] 입금 확인 후 · KA01TP260906111937411oOGf3DvHzvk
// 3. [살롱] 취소 시 · KA01TP260906112315549mUsVO3mwUOp
// 4. [스테이] 예약 신청 접수 시 · KA01TP260906113200151llfNLykPo8D
// 5. [스테이] 입금 확인 후 · KA01TP260906113427164x8hMIBrOnlo
// 6. [스테이] 취소 시 · KA01TP260906145135509OW6gQGoG34u
// (본문 상수는 src/lib/kakao-texts.ts)

/* ─── 타입 ──────────────────────────────────────── */
export type BookingEvent = "received" | "confirmed" | "cancelled";

export type Booking = {
  type: "salon" | "stay";
  name: string;
  phone: string;
  program?: string;
  date?: string;
  room?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  discount?: string;
  totalAmount: number;
  createdAt?: string;
  /** 이벤트를 일으킨 경로. 호스트 문자의 "어떤 액션" 문장에 쓴다. */
  via?: "web" | "admin" | "toss";
};

export type KakaoOptions = {
  pfId: string;
  templateId: string;
  variables: Record<string, string>;
  disableSms: boolean;
};

export type BuiltMessage = {
  text: string;
  kakaoOptions?: KakaoOptions;
};

/** 이번 발송에서 실제로 보낼 메시지 (없으면 발송 대상 아님) */
export type MessagePlan = {
  guest?: BuiltMessage;
  host?: BuiltMessage;
};

export type SendResult = "ok" | "skipped" | { error: string };

export type SendBookingResult = {
  guest: SendResult;
  host: SendResult;
  groupId?: string;
  /** 게스트를 건너뛴 이유 (예: "연락처 없음"). guest === "skipped"일 때만 있다. */
  guestSkipReason?: string;
  /** 호스트 알림이 실제로 나간 경로. 슬랙 우선 → 실패·미설정이면 문자. 수신처가 없으면 "none". */
  hostChannel?: HostChannel;
};

/* ─── 헬퍼 ──────────────────────────────────────── */
function stripPhone(phone: string) {
  return (phone || "").replace(/[^0-9]/g, "");
}

/** 금액 표기 (1,000 단위 쉼표). 호스트 문자·슬랙 블록이 같은 함수를 쓴다. */
export function won(amount: number) {
  return (amount || 0).toLocaleString("en-US");
}

/** 등록본 본문의 #{키}를 값으로 치환한다. 값이 없는 변수는 그대로 남긴다. */
export function fill(template: string, variables: Record<string, string>): string {
  return template.replace(/#\{[^}]+\}/g, (m) => variables[m] ?? m);
}

export function typeLabel(booking: Booking) {
  return booking.type === "salon" ? "살롱" : "스테이";
}

/** 호스트 문안에 들어가는 한 줄 요약 */
export function detailLine(booking: Booking) {
  return booking.type === "salon"
    ? `${booking.program ?? ""} / ${booking.date ?? ""}`
    : `${booking.room ?? ""} / ${booking.checkIn ?? ""} ~ ${booking.checkOut ?? ""}`;
}

const EVENT_LABEL: Record<BookingEvent, string> = {
  received: "새 신청",
  confirmed: "입금확인 완료",
  cancelled: "취소 처리",
};

/**
 * 호스트 알림 제목에 쓰는 이벤트 이름. 카드결제로 확정된 건만 따로 표기한다.
 * 문자(buildHostMessage)와 슬랙(buildHostBlocks)이 같은 이름을 쓰도록 한 곳에 둔다.
 */
export function hostEventLabel(event: BookingEvent, booking: Booking): string {
  return event === "confirmed" && booking.via === "toss" ? "카드결제 완료" : EVENT_LABEL[event];
}

/** 템플릿 ID와 pfId가 모두 있을 때만 kakaoOptions를 만든다. */
export function kakaoOptions(
  templateEnv: string | undefined,
  variables: Record<string, string>
): KakaoOptions | undefined {
  const pfId = process.env.KAKAO_PFID;
  if (!pfId || !templateEnv) return undefined;
  return { pfId, templateId: templateEnv, variables, disableSms: false };
}

/** 본문 상수 + 변수로 메시지를 만든다. 본문과 변수 키가 한 소스에서 나온다. */
function build(
  template: string,
  templateEnv: string | undefined,
  variables: Record<string, string>
): BuiltMessage {
  return { text: fill(template, variables), kakaoOptions: kakaoOptions(templateEnv, variables) };
}

/* ─── 게스트 문안 ───────────────────────────────── */
function salonReceived(b: Booking): BuiltMessage {
  return build(TEXT_SALON_RECEIVED, process.env.KAKAO_TEMPLATE_SALON_RECEIVED, {
    "#{이름}": b.name,
    "#{프로그램명}": b.program ?? "",
    "#{일시}": b.date ?? "",
    "#{금액}": won(b.totalAmount),
  });
}

function salonConfirmed(b: Booking): BuiltMessage {
  return build(TEXT_SALON_CONFIRMED, process.env.KAKAO_TEMPLATE_SALON_CONFIRMED, {
    "#{이름}": b.name,
    "#{프로그램명}": b.program ?? "",
    "#{일시}": b.date ?? "",
  });
}

function salonCancelled(b: Booking): BuiltMessage {
  return build(TEXT_SALON_CANCELLED, process.env.KAKAO_TEMPLATE_SALON_CANCELLED, {
    "#{이름}": b.name,
    "#{프로그램명}": b.program ?? "",
    "#{일시}": b.date ?? "",
  });
}

function stayReceived(b: Booking): BuiltMessage {
  return build(TEXT_STAY_RECEIVED, process.env.KAKAO_TEMPLATE_STAY_RECEIVED, {
    "#{이름}": b.name,
    "#{객실명}": b.room ?? "",
    "#{체크인날짜}": b.checkIn ?? "",
    "#{체크아웃날짜}": b.checkOut ?? "",
    "#{묵는일수}": String(b.nights ?? 0),
    "#{금액}": won(b.totalAmount),
  });
}

function stayConfirmed(b: Booking): BuiltMessage {
  return build(TEXT_STAY_CONFIRMED, process.env.KAKAO_TEMPLATE_STAY_CONFIRMED, {
    "#{이름}": b.name,
    "#{객실명}": b.room ?? "",
    "#{체크인날짜}": b.checkIn ?? "",
    "#{체크아웃날짜}": b.checkOut ?? "",
    "#{묵는일수}": String(b.nights ?? 0),
  });
}

function stayCancelled(b: Booking): BuiltMessage {
  return build(TEXT_STAY_CANCELLED, process.env.KAKAO_TEMPLATE_STAY_CANCELLED, {
    "#{이름}": b.name,
    "#{객실명}": b.room ?? "",
    "#{체크인시간}": b.checkIn ?? "",
    "#{체크아웃시간}": b.checkOut ?? "",
  });
}

/** 게스트 메시지 조립 (순수 함수) */
export function buildGuestMessage(event: BookingEvent, booking: Booking): BuiltMessage {
  const salon = booking.type === "salon";
  if (event === "cancelled") return salon ? salonCancelled(booking) : stayCancelled(booking);
  if (event === "confirmed") return salon ? salonConfirmed(booking) : stayConfirmed(booking);
  return salon ? salonReceived(booking) : stayReceived(booking);
}

/**
 * 호스트 메시지 조립 (순수 함수).
 * 등록 템플릿이 없어 기본은 문자다. KAKAO_TEMPLATE_HOST를 넣으면 알림톡으로 전환된다.
 */
export type HostContext = {
  /** 게스트 알림 발송 결과. 있으면 호스트 문자 끝에 안내를 덧붙인다. */
  guestResult?: SendResult;
  /** 게스트를 건너뛴 이유 (예: "연락처 없음"). */
  guestSkipReason?: string;
  /** 액션 시각 (기본 now). 테스트용. */
  at?: Date;
};

export function kstStamp(d: Date) {
  const md = d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })
    .replace(/\s/g, "").replace(/\.$/, "").replace(".", "/");
  const hm = d.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
  return `${md} ${hm}`;
}

/** 호스트 문자용 예약 내용 줄들 */
function hostDetailLines(b: Booking): string[] {
  if (b.type === "salon") {
    return [`프로그램: ${b.program ?? ""}`, `일시: ${b.date ?? ""}`];
  }
  const nights = b.nights ? ` (${b.nights}박)` : "";
  return [`객실: ${b.room ?? ""}`, `체크인 ${b.checkIn ?? ""} ~ 체크아웃 ${b.checkOut ?? ""}${nights}`];
}

/** 누가 · 언제 · 무엇을 · 어떤 액션 — 한 문장 */
function hostActionLine(event: BookingEvent, b: Booking, when: string): string {
  const label = typeLabel(b);
  if (event === "received") return `${b.name}님이 ${when}에 ${label} 예약을 신청했어요.`;
  if (event === "confirmed") {
    return b.via === "toss"
      ? `${b.name}님이 ${when}에 ${label} 요금을 카드로 결제했어요. 예약이 자동 확정됐어요.`
      : `${b.name}님의 ${label} 예약을 ${when}에 입금확인 처리했어요.`;
  }
  return `${b.name}님의 ${label} 예약을 ${when}에 취소 처리했어요.`;
}

/** 호스트가 다음에 할 일 + 게스트 알림 결과 */
function hostNextLines(event: BookingEvent, ctx: HostContext): string[] {
  const guest = ctx.guestResult;
  const guestLine =
    guest === undefined ? null
    : guest === "ok" ? "게스트에게 안내 알림톡을 보냈어요."
    : guest === "skipped" ? `게스트 알림은 아직 발송되지 않았어요 (${ctx.guestSkipReason ?? "템플릿 미설정"}).`
    : `게스트 알림 발송 실패 (${guest.error.replace(/\.$/, "")}). 어드민에서 재발송해 주세요.`;
  const next =
    event === "received" ? "입금이 확인되면 어드민에서 '입금확인'을 눌러주세요."
    : event === "confirmed" ? null
    : "이미 입금된 건이면 환불 처리가 필요해요.";
  return [guestLine, next].filter((x): x is string => !!x);
}

export function buildHostMessage(event: BookingEvent, booking: Booking, ctx: HostContext = {}): BuiltMessage {
  const eventLabel = hostEventLabel(event, booking);
  const label = typeLabel(booking);
  const detail = detailLine(booking);
  const amount = won(booking.totalAmount);
  const when = kstStamp(ctx.at ?? new Date());

  const variables = {
    "#{event}": eventLabel,
    "#{type}": label,
    "#{name}": booking.name,
    "#{phone}": booking.phone,
    "#{detail}": detail,
    "#{amount}": amount,
  };

  const amountLine =
    event === "received" ? `금액: ${amount}원 · 입금 대기`
    : event === "confirmed" ? `금액: ${amount}원 · ${booking.via === "toss" ? "카드결제 완료" : "입금 확인"}`
    : `금액: ${amount}원`;

  const text = [
    `[코이노니아] ${eventLabel} · ${label}`,
    hostActionLine(event, booking, when),
    ``,
    ...hostDetailLines(booking),
    amountLine,
    `연락처: ${booking.phone}`,
    ``,
    ...hostNextLines(event, ctx),
    `${ADMIN_URL}`,
  ].join("\n");

  return { text, kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_HOST, variables) };
}

/** 알림톡 템플릿이 갖춰진 메시지인지 (순수 함수). */
export function isSendable(m: BuiltMessage): boolean {
  return !!m.kakaoOptions;
}

/**
 * 이번 이벤트에서 실제로 보낼 메시지를 고른다 (순수 함수).
 *
 * - 게스트: 알림톡 템플릿이 없으면 보내지 않는다 (검수 전 차단).
 * - 호스트: 템플릿과 무관하게 항상 보낸다 (문자, HOST 템플릿 있으면 알림톡). 템플릿이 없어도 문자로 보낸다.
 * - hostOnly(어드민 알림 테스트): 게스트는 건너뛰고 호스트만 보낸다.
 */
export function planMessages(
  event: BookingEvent,
  booking: Booking,
  opts: { hostOnly?: boolean; hasHostRecipient?: boolean } = {}
): MessagePlan {
  const host = opts.hasHostRecipient ? buildHostMessage(event, booking) : undefined;

  if (opts.hostOnly) return { host };

  // 호스트는 템플릿과 무관하게 항상 문자로 받는다(운영 알림).
  // 게스트는 알림톡 템플릿이 있을 때만 (검수 전 차단).
  const guest = buildGuestMessage(event, booking);
  if (!isSendable(guest)) return { host };

  return { guest, host };
}

/* ─── 발송 ──────────────────────────────────────── */
function hasSolapi() {
  return !!(
    process.env.SOLAPI_API_KEY &&
    process.env.SOLAPI_API_SECRET &&
    process.env.SOLAPI_SENDER_PHONE
  );
}

type FailedEntry = {
  readonly to?: string;
  readonly statusMessage?: string;
  readonly statusCode?: string;
};

function failureOf(to: string, failed: readonly FailedEntry[]): SendResult {
  const hit = failed.find((f) => stripPhone(f.to ?? "") === to);
  if (!hit) return "ok";
  return { error: `${hit.statusCode ?? ""} ${hit.statusMessage ?? "발송 실패"}`.trim() };
}

/**
 * 게스트 → 호스트 순서로 두 번 발송한다 (게스트 결과를 호스트 알림에 싣기 위해).
 * 알림톡 옵션이 없으면 text만 보내 순수 문자로 나간다.
 * 호스트는 notifyHost가 슬랙 → 문자 순으로 고른다 (게스트 경로는 그대로 솔라피).
 */
export async function sendBookingMessages(
  event: BookingEvent,
  booking: Booking,
  opts: { hostOnly?: boolean } = {}
): Promise<SendBookingResult> {
  if (!hasSolapi()) {
    // 솔라피가 없어도 호스트 슬랙은 살아 있어야 한다 (문자 대체만 불가능).
    console.warn("[NOTIFY] 솔라피 환경변수 미설정 — 게스트 발송 건너뜀");
    const only = await notifyHost(event, booking);
    return { guest: "skipped", host: only.result, hostChannel: only.channel };
  }

  const from = stripPhone(process.env.SOLAPI_SENDER_PHONE!);
  // 사용일이 컷오프(2026-09-10) 이전인 지난 예약은 게스트에게 보내지 않는다 (운영 요청).
  const past = !opts.hostOnly && isPastBooking(booking);
  const guestTo = opts.hostOnly || past ? "" : stripPhone(booking.phone);
  let hostTo = stripPhone(process.env.OPERATOR_PHONE ?? "");
  // 게스트와 호스트가 같은 번호면 솔라피가 중복 수신번호(1026)로 실패 처리하므로 호스트 사본은 건너뛴다.
  if (guestTo && hostTo === guestTo) hostTo = "";

  const plan = planMessages(event, booking, { hostOnly: opts.hostOnly, hasHostRecipient: !!hostTo });
  const client = new SolapiMessageService(process.env.SOLAPI_API_KEY!, process.env.SOLAPI_API_SECRET!);

  // 1) 게스트 먼저 — 결과를 호스트 문자에 실어야 하므로 순서대로 보낸다.
  //    연락처가 빈 행(시트 수기 입력)도 게스트만 건너뛰고 호스트 알림·상태 변경은 그대로 간다.
  let guest: SendResult = "skipped";
  let guestSkipReason: string | undefined;
  let groupId: string | undefined;
  if (plan.guest && guestTo) {
    const r = await sendSingle(client, { to: guestTo, from, text: plan.guest.text, kakaoOptions: plan.guest.kakaoOptions });
    guest = r.result;
    groupId = r.groupId;
  } else if (!opts.hostOnly) {
    guestSkipReason = past ? "지난 예약" : guestTo ? "템플릿 미설정" : "연락처 없음";
    console.warn(`[NOTIFY] ${guestSkipReason} — ${event} 게스트 발송 건너뜀`);
  }

  // 2) 호스트 — 게스트 결과 포함. 슬랙 우선, 실패·미설정이면 아래 문자 콜백으로 대체된다.
  //    슬랙은 OPERATOR_PHONE이 없어도 나간다(문자 수신처와 무관).
  const hostCtx: HostContext = {
    guestResult: opts.hostOnly ? undefined : guest,
    guestSkipReason,
  };
  const sendHostSms =
    plan.host && hostTo
      ? async (): Promise<SendResult> => {
          const m = buildHostMessage(event, booking, hostCtx);
          const r = await sendSingle(client, {
            to: hostTo,
            from,
            text: m.text,
            kakaoOptions: m.kakaoOptions,
          });
          groupId = groupId ?? r.groupId;
          return r.result;
        }
      : undefined;

  const hostSent = await notifyHost(event, booking, hostCtx, sendHostSms);

  return {
    guest,
    host: hostSent.result,
    hostChannel: hostSent.channel,
    groupId,
    ...(guestSkipReason ? { guestSkipReason } : {}),
  };
}

async function sendSingle(
  client: SolapiMessageService,
  msg: { to: string; from: string; text: string; kakaoOptions?: KakaoOptions }
): Promise<{ result: SendResult; groupId?: string }> {
  try {
    const res = await client.send(msg);
    const failed: readonly FailedEntry[] = res.failedMessageList ?? [];
    return { result: failureOf(msg.to, failed), groupId: res.groupInfo?.groupId };
  } catch (e) {
    // 전량 접수 실패 시 SDK가 MessageNotReceivedError 를 throw 한다. 건별 사유는 failedMessageList 에.
    const failed = (e as { failedMessageList?: readonly FailedEntry[] })?.failedMessageList;
    if (Array.isArray(failed) && failed.length > 0) return { result: failureOf(msg.to, failed) };
    return { result: { error: e instanceof Error ? e.message : String(e) } };
  }
}
