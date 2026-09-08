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

const ADMIN_URL = "koinonia-web.vercel.app/admin";

/* ─── 등록본 본문 (솔라피 덤프 content 그대로) ──── */
// 1. [살롱] 신청 접수 시 · KA01TP260906111616282uwVQwrob8OX
const TEXT_SALON_RECEIVED =
  "안녕하세요, #{이름}님.\n코이노니아 살롱 신청이 접수되었습니다.\n\n■ 신청 내역\n프로그램: #{프로그램명}\n일시: #{일시}\n참가비: #{금액}원\n\n아래 계좌로 입금해 주시면 \n참가가 확정됩니다.\n- 하나은행 5539-10-13844507 \n(코이노니아)\n입금자명: #{이름}\n\n감사합니다. 코이노니아에서 함께할 날을 기다리고 있을게요 🌿";

// 2. [살롱] 입금 확인 후 · KA01TP260906111937411oOGf3DvHzvk
const TEXT_SALON_CONFIRMED =
  "#{이름}님, 코이노니아 살롱 참가가 확정되었습니다.\n\n■ 확정 내역\n프로그램: #{프로그램명}\n일시: #{일시}\n장소: 코이노니아 (경북 안동시)\n\n당일 일정 변경이 필요하시면 \n010-2608-9144 으로 \n미리 연락 부탁드립니다.\n\n함께해 주셔서 진심으로 감사해요. \n코이노니아에서 즐거운 시간 되시길 바랍니다 🎉";

// 3. [살롱] 취소 시 · KA01TP260906112315549mUsVO3mwUOp
const TEXT_SALON_CANCELLED =
  "#{이름}님, 코이노니아 살롱 예약이 취소 처리되었습니다.\n\n■ 취소 내역\n#{프로그램명} / #{일시}\n\n■ 환불 안내\n진행 하루 전까지 취소 시 100% 환불.\n당일 취소는 환불이 어렵습니다.\n환불 규정에 해당하시는 경우, 입금하신 계좌로 환불 처리해 드립니다.\n\n문의: 010-2608-9144\n\n다음에 꼭 함께해요! 코이노니아는 언제든 기다리고 있을게요 🌿";

// 4. [스테이] 예약 신청 접수 시 · KA01TP260906113200151llfNLykPo8D
const TEXT_STAY_RECEIVED =
  "안녕하세요, #{이름}님.\n코이노니아 스테이 예약 신청이 접수되었습니다.\n\n■ 예약 내역\n객실: #{객실명}\n체크인: #{체크인날짜}\n체크아웃: #{체크아웃날짜} (#{묵는일수}박)\n총 금액: #{금액}원\n\n아래 계좌로 입금해 주시면 예약이 확정됩니다.\n- 하나은행 5539-10-13844507 \n(코이노니아)\n입금자명: #{이름}\n\n감사합니다. 안동에서 뵐 날을 설레는 마음으로 기다리고 있을게요 🌿";

// 5. [스테이] 입금 확인 후 · KA01TP260906113427164x8hMIBrOnlo
const TEXT_STAY_CONFIRMED =
  "#{이름}님, 코이노니아 스테이 예약이 확정되었습니다.\n\n■ 확정 내역\n객실: #{객실명}\n체크인: #{체크인날짜} 15:00\n체크아웃: #{체크아웃날짜} 11:00 (#{묵는일수}박)\n\n체크인 전날 입실 방법과 스테이 가이드를 다시 안내드립니다.\n숙박 관련 문의는 010-2608-9144 으로 언제든 편하게 연락 주세요.\n\n안동에서 따뜻하게 맞이할게요. 편안한 쉼이 되시길 바랍니다 🌿";

// 6. [스테이] 취소 시 · KA01TP260906145135509OW6gQGoG34u
// 등록본에 '[' 오타가 있고 변수명이 "시간"이지만 실제 값은 날짜다. 등록본을 그대로 따른다.
const TEXT_STAY_CANCELLED =
  "#{이름}님, 코이노니아 스테이 예약이 취소 처리되었습니다.\n\n■ 취소 내역\n#{객실명}/ #{체크인시간} ~ #{체크아웃시간}\n\n■ 환불 안내\n체크인 48시간 전까지 취소 시 100% 환불. 이후 취소는 환불이 어렵습니다.\n환불 규정에 해당하시는 경우, 입금하신 계좌로 환불 처리해 드립니다.\n\n문의: 010-2608-9144\n\n다음에 꼭 함께해요! 코이노니아는 언제든 기다리고 있을게요 🌿";

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
};

/* ─── 헬퍼 ──────────────────────────────────────── */
function stripPhone(phone: string) {
  return (phone || "").replace(/[^0-9]/g, "");
}

function won(amount: number) {
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
  const eventLabel = event === "confirmed" && booking.via === "toss" ? "카드결제 완료" : EVENT_LABEL[event];
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
 * 게스트 → 호스트 순서로 두 번 발송한다 (게스트 결과를 호스트 문자에 싣기 위해).
 * 알림톡 옵션이 없으면 text만 보내 순수 문자로 나간다.
 */
export async function sendBookingMessages(
  event: BookingEvent,
  booking: Booking,
  opts: { hostOnly?: boolean } = {}
): Promise<SendBookingResult> {
  if (!hasSolapi()) {
    console.warn("[NOTIFY] 솔라피 환경변수 미설정 — 발송 건너뜀");
    return { guest: "skipped", host: "skipped" };
  }

  const from = stripPhone(process.env.SOLAPI_SENDER_PHONE!);
  const guestTo = opts.hostOnly ? "" : stripPhone(booking.phone);
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
    guestSkipReason = guestTo ? "템플릿 미설정" : "연락처 없음";
    console.warn(`[NOTIFY] ${guestSkipReason} — ${event} 게스트 발송 건너뜀`);
  }

  // 2) 호스트 — 게스트 결과 포함
  let host: SendResult = "skipped";
  if (plan.host && hostTo) {
    const m = buildHostMessage(event, booking, {
      guestResult: opts.hostOnly ? undefined : guest,
      guestSkipReason,
    });
    const r = await sendSingle(client, { to: hostTo, from, text: m.text, kakaoOptions: m.kakaoOptions });
    host = r.result;
    groupId = groupId ?? r.groupId;
  }

  return { guest, host, groupId, ...(guestSkipReason ? { guestSkipReason } : {}) };
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
