/**
 * 카카오 알림톡 + 문자 대체 발송 (Solapi)
 *
 * 문안은 docs/alimtalk-templates.md 와 1:1로 대응한다.
 * 템플릿을 바꾸면 이 파일의 문안·변수 키도 같이 바꿔야 한다.
 *
 * 환경변수:
 *   SOLAPI_API_KEY / SOLAPI_API_SECRET  — 솔라피 인증
 *   SOLAPI_SENDER_PHONE                 — 등록된 발신번호 (하이픈 없이)
 *   KAKAO_PFID                          — 카카오 채널 pfId
 *   KAKAO_TEMPLATE_SALON_RECEIVED / STAY_RECEIVED
 *   KAKAO_TEMPLATE_SALON_CONFIRMED / STAY_CONFIRMED
 *   KAKAO_TEMPLATE_CANCELLED            — 게스트 취소 공통
 *   KAKAO_TEMPLATE_HOST                 — 호스트 알림 공통
 *   OPERATOR_PHONE                      — 호스트 수신번호
 */

import { SolapiMessageService } from "solapi";

/* ─── 문안 상수 ─────────────────────────────────── */
const BANK_ACCOUNT = "하나은행 5539-10-13844507 (코이노니아)";
const INSTAGRAM = "@koinonia_andong";
const STAY_CHECKIN_TIME = "15:00";
const STAY_CHECKOUT_TIME = "11:00";

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

export type SendResult = "ok" | "skipped" | { error: string };

export type SendBookingResult = {
  guest: SendResult;
  host: SendResult;
  groupId?: string;
};

/* ─── 헬퍼 ──────────────────────────────────────── */
function stripPhone(phone: string) {
  return (phone || "").replace(/[^0-9]/g, "");
}

function won(amount: number) {
  return (amount || 0).toLocaleString("en-US");
}

export function typeLabel(booking: Booking) {
  return booking.type === "salon" ? "살롱" : "스테이";
}

/** 호스트/취소 문안에 들어가는 한 줄 요약 */
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
function kakaoOptions(
  templateEnv: string | undefined,
  variables: Record<string, string>
): KakaoOptions | undefined {
  const pfId = process.env.KAKAO_PFID;
  if (!pfId || !templateEnv) return undefined;
  return { pfId, templateId: templateEnv, variables, disableSms: false };
}

/* ─── 게스트 문안 ───────────────────────────────── */
function salonReceived(b: Booking): BuiltMessage {
  const variables = {
    "#{name}": b.name,
    "#{program}": b.program ?? "",
    "#{date}": b.date ?? "",
    "#{amount}": won(b.totalAmount),
  };
  const text = [
    `안녕하세요, ${b.name}님.`,
    `코이노니아 살롱 신청이 접수되었습니다.`,
    ``,
    `■ 신청 내역`,
    `프로그램: ${b.program ?? ""}`,
    `일시: ${b.date ?? ""}`,
    `참가비: ${won(b.totalAmount)}원`,
    ``,
    `아래 계좌로 입금해 주시면 참가가 확정됩니다.`,
    BANK_ACCOUNT,
    `입금자명: ${b.name}`,
    ``,
    `입금이 확인되면 확정 안내를 다시 보내드립니다.`,
  ].join("\n");
  return { text, kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_SALON_RECEIVED, variables) };
}

function stayReceived(b: Booking): BuiltMessage {
  const nights = String(b.nights ?? 0);
  const variables = {
    "#{name}": b.name,
    "#{room}": b.room ?? "",
    "#{checkIn}": b.checkIn ?? "",
    "#{checkOut}": b.checkOut ?? "",
    "#{nights}": nights,
    "#{amount}": won(b.totalAmount),
  };
  const text = [
    `안녕하세요, ${b.name}님.`,
    `코이노니아 스테이 예약 신청이 접수되었습니다.`,
    ``,
    `■ 예약 내역`,
    `객실: ${b.room ?? ""}`,
    `체크인: ${b.checkIn ?? ""}`,
    `체크아웃: ${b.checkOut ?? ""} (${nights}박)`,
    `총 금액: ${won(b.totalAmount)}원`,
    ``,
    `아래 계좌로 입금해 주시면 예약이 확정됩니다.`,
    BANK_ACCOUNT,
    `입금자명: ${b.name}`,
    ``,
    `입금이 확인되면 확정 안내를 다시 보내드립니다.`,
  ].join("\n");
  return { text, kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_STAY_RECEIVED, variables) };
}

function salonConfirmed(b: Booking): BuiltMessage {
  const variables = {
    "#{name}": b.name,
    "#{program}": b.program ?? "",
    "#{date}": b.date ?? "",
  };
  const text = [
    `${b.name}님, 코이노니아 살롱 참가가 확정되었습니다.`,
    ``,
    `■ 확정 내역`,
    `프로그램: ${b.program ?? ""}`,
    `일시: ${b.date ?? ""}`,
    `장소: 코이노니아 (경북 안동시)`,
    ``,
    `당일 일정 변경이 필요하시면 인스타그램 ${INSTAGRAM} 으로 미리 연락 부탁드립니다.`,
    ``,
    `코이노니아에서 뵙겠습니다.`,
  ].join("\n");
  return { text, kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_SALON_CONFIRMED, variables) };
}

function stayConfirmed(b: Booking): BuiltMessage {
  const nights = String(b.nights ?? 0);
  const variables = {
    "#{name}": b.name,
    "#{room}": b.room ?? "",
    "#{checkIn}": b.checkIn ?? "",
    "#{checkOut}": b.checkOut ?? "",
    "#{nights}": nights,
  };
  const text = [
    `${b.name}님, 코이노니아 스테이 예약이 확정되었습니다.`,
    ``,
    `■ 확정 내역`,
    `객실: ${b.room ?? ""}`,
    `체크인: ${b.checkIn ?? ""} ${STAY_CHECKIN_TIME}`,
    `체크아웃: ${b.checkOut ?? ""} ${STAY_CHECKOUT_TIME} (${nights}박)`,
    ``,
    `체크인 전날 입실 방법과 스테이 가이드를 다시 안내드립니다.`,
    `숙박 관련 문의는 언제든 편하게 연락 주세요.`,
    ``,
    `안동에서 뵙겠습니다.`,
  ].join("\n");
  return { text, kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_STAY_CONFIRMED, variables) };
}

function cancelled(b: Booking): BuiltMessage {
  const label = typeLabel(b);
  const detail = detailLine(b);
  const variables = {
    "#{name}": b.name,
    "#{type}": label,
    "#{detail}": detail,
  };
  const text = [
    `${b.name}님, 코이노니아 ${label} 예약이 취소 처리되었습니다.`,
    ``,
    `■ 취소 내역`,
    detail,
    ``,
    `이미 입금하신 경우 환불 안내를 별도로 드립니다.`,
    `문의: 인스타그램 ${INSTAGRAM}`,
    ``,
    `다음에 다시 뵙기를 기다리겠습니다.`,
  ].join("\n");
  return { text, kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_CANCELLED, variables) };
}

/** 게스트 메시지 조립 (순수 함수) */
export function buildGuestMessage(event: BookingEvent, booking: Booking): BuiltMessage {
  if (event === "cancelled") return cancelled(booking);
  if (event === "confirmed") {
    return booking.type === "salon" ? salonConfirmed(booking) : stayConfirmed(booking);
  }
  return booking.type === "salon" ? salonReceived(booking) : stayReceived(booking);
}

/** 호스트 메시지 조립 (순수 함수) */
export function buildHostMessage(event: BookingEvent, booking: Booking): BuiltMessage {
  const eventLabel = EVENT_LABEL[event];
  const label = typeLabel(booking);
  const detail = detailLine(booking);
  const amount = won(booking.totalAmount);

  const variables = {
    "#{event}": eventLabel,
    "#{type}": label,
    "#{name}": booking.name,
    "#{phone}": booking.phone,
    "#{detail}": detail,
    "#{amount}": amount,
  };

  const text = [
    `[코이노니아] ${eventLabel} · ${label}`,
    ``,
    `이름: ${booking.name}`,
    `연락처: ${booking.phone}`,
    `내용: ${detail}`,
    `금액: ${amount}원`,
  ].join("\n");

  return { text, kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_HOST, variables) };
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
 * 게스트 + 호스트 메시지를 한 번의 send() 로 발송한다.
 * 알림톡 템플릿이 없으면 text만 보내 순수 문자로 나간다.
 */
export async function sendBookingMessages(
  event: BookingEvent,
  booking: Booking
): Promise<SendBookingResult> {
  if (!hasSolapi()) {
    console.warn("[NOTIFY] 솔라피 환경변수 미설정 — 발송 건너뜀");
    return { guest: "skipped", host: "skipped" };
  }

  const from = stripPhone(process.env.SOLAPI_SENDER_PHONE!);
  const guestTo = stripPhone(booking.phone);
  const hostTo = stripPhone(process.env.OPERATOR_PHONE ?? "");

  const messages: {
    to: string;
    from: string;
    text: string;
    kakaoOptions?: KakaoOptions;
  }[] = [];

  if (guestTo) {
    const m = buildGuestMessage(event, booking);
    messages.push({ to: guestTo, from, text: m.text, kakaoOptions: m.kakaoOptions });
  }
  if (hostTo) {
    const m = buildHostMessage(event, booking);
    messages.push({ to: hostTo, from, text: m.text, kakaoOptions: m.kakaoOptions });
  }

  if (messages.length === 0) {
    return { guest: "skipped", host: "skipped" };
  }

  try {
    const client = new SolapiMessageService(
      process.env.SOLAPI_API_KEY!,
      process.env.SOLAPI_API_SECRET!
    );
    const res = await client.send(messages);
    const failed: readonly FailedEntry[] = res.failedMessageList ?? [];
    return {
      guest: guestTo ? failureOf(guestTo, failed) : "skipped",
      host: hostTo ? failureOf(hostTo, failed) : "skipped",
      groupId: res.groupInfo?.groupId,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      guest: guestTo ? { error } : "skipped",
      host: hostTo ? { error } : "skipped",
    };
  }
}
