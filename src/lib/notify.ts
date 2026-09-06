/**
 * cron 안내 발송 (Solapi) — 체크인 D-1 · 체크아웃 당일
 *
 * 본문 상수는 솔라피 등록본(phases/notify/solapi-templates.json)의 7·8번 그대로다.
 * 템플릿 env + KAKAO_PFID 가 있으면 알림톡(실패 시 문자 대체),
 * 없으면 같은 본문을 문자로 보낸다 (운영 중인 안내라 끊지 않는다).
 *
 * 필요한 환경변수:
 *   SOLAPI_API_KEY       — Solapi 콘솔 > API Key
 *   SOLAPI_API_SECRET    — Solapi 콘솔 > API Secret
 *   SOLAPI_SENDER_PHONE  — 발신번호 (Solapi에 등록한 번호, 하이픈 없이)
 *   KAKAO_PFID           — 카카오 채널 pfId
 *   KAKAO_TEMPLATE_STAY_REMINDER  — 7. [스테이] 체크인 전날 D-1 (선택)
 *   KAKAO_TEMPLATE_STAY_CHECKOUT  — 8. [스테이] 체크아웃 당일 (선택)
 *
 * 예약 상태 알림(접수·확정·취소)은 src/lib/messaging.ts 의 notifyBooking 이 담당한다.
 */

import { SolapiMessageService } from "solapi";
import { fill, kakaoOptions, type BuiltMessage } from "@/lib/kakao";

/* ─── 등록본 본문 (솔라피 덤프 content 그대로) ──── */
// 7. [스테이] 체크인 전날 D-1 (자동 발송) · KA01TP2609061459009997cIwUSazlQn
const TEXT_STAY_REMINDER =
  "안녕하세요, #{이름}님.\n내일은 코이노니아 스테이 체크인 날입니다.\n\n[입실 안내]\n▶ 체크인: #{체크인날짜} 15:00\n▶ 체크아웃: #{체크아웃날짜} 11:00\n▶ 체크인 방법\n1. 건물 외부에 있는 계단을 이용해 3층으로 올라옵니다.\n2. 3층 출입문 비밀번호 : 3927*\n3. 체크인 객실명을 확인 후 입실합니다.\n\n체크인은 오후 3시부터 10시까지 가능하며, 음주 상태에서 입실은 불가능합니다.\n교통 이슈로 인해 밤 10시 이후에 입실할 경우 미리 호스트에게 메세지를 남겨 주세요.\n체크아웃은 오전 11시이며, 레이트 체크아웃은 어렵습니다.\n\n[숙소 이용 안내]\n숙소 이동 방법, 출입, 주차, 와이파이 정보와 안동 여행 정보를 상세하게 담은 스테이 가이드를 공유해 드립니다.\n▶ 스테이 가이드\nhttps://shorturl.at/ZCjqD\n\n[와이파이 안내]\n▶ ID : Koinonia stay / PW: welcome2koinonia\n\n숙박과 관련해 궁금한 점이 있다면 \n010-2608-9144 로 \n언제든 편하게 연락 주세요.\n\n내일 뵙겠습니다! 설레는 안동 여행 되시길 바랍니다 🌿\n\n반가운 마음을 담아, \n코이노니아 드림";

// 8. [스테이] 체크아웃 당일 (자동 발송) · KA01TP2609061500047704yNnPWcl2KG
const TEXT_STAY_CHECKOUT =
  "안녕하세요, #{이름}님.\n기분 좋은 하루 시작하셨나요?\n\n코이노니아 체크아웃 메세지를 전해 드립니다.\n체크아웃은 오전 11시까지입니다.\n12시부터 클리닝 타임이 진행되니 체크아웃 시간을 지켜 주세요.\n\n▶ 스테이 경험 나누기\n편안한 여정이 되셨다면, 구글맵에 코이노니아 리뷰를 남겨 주세요.\n\n▶ 안동 기념품 선물 및 구매 (1층 스토어)\n안동의 물과 쌀을 빚어 만든 안동 소주, 일엽편주, 진맥소주, 진저 고유 등 우리 지역의 특산물을 소개하고 있습니다.\n\n▶ 러기지 서비스\n여행하는 동안 코이노니아에 짐을 맡기실 수 있습니다. (캐리어당 5천원)\n\n코이노니아 스테이에 머물러 주셔서 진심으로 감사합니다.\n안동에서 유쾌하고 행복한 시간 보내시길 바라요 😊\n\n문의: 010-2608-9144\n코이노니아 드림";

function getClient() {
  return new SolapiMessageService(
    process.env.SOLAPI_API_KEY!,
    process.env.SOLAPI_API_SECRET!
  );
}

function strip(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

function hasSolapi() {
  return !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER_PHONE);
}

/** 체크인 D-1 안내 조립 (순수 함수) */
export function buildCheckinReminderMessage(guest: {
  name: string;
  checkIn: string;
  checkOut: string;
}): BuiltMessage {
  const variables = {
    "#{이름}": guest.name,
    "#{체크인날짜}": guest.checkIn,
    "#{체크아웃날짜}": guest.checkOut,
  };
  return {
    text: fill(TEXT_STAY_REMINDER, variables),
    kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_STAY_REMINDER, variables),
  };
}

/** 체크아웃 당일 안내 조립 (순수 함수) */
export function buildCheckoutMessage(guest: { name: string }): BuiltMessage {
  const variables = { "#{이름}": guest.name };
  return {
    text: fill(TEXT_STAY_CHECKOUT, variables),
    kakaoOptions: kakaoOptions(process.env.KAKAO_TEMPLATE_STAY_CHECKOUT, variables),
  };
}

/**
 * 알림톡이 접수 단계에서 거부되면(템플릿 미승인·ID 오류 등, 이때는 솔라피의 문자 대체가 동작하지 않는다)
 * 같은 본문을 문자로 다시 보낸다. 운영 중인 안내라 끊기지 않게 하기 위함.
 */
async function sendOne(to: string, message: BuiltMessage) {
  const client = getClient();
  const base = { to: strip(to), from: strip(process.env.SOLAPI_SENDER_PHONE!), text: message.text };
  if (!message.kakaoOptions) {
    await client.send(base);
    return;
  }
  try {
    await client.send({ ...base, kakaoOptions: message.kakaoOptions });
  } catch (e) {
    const failed = (e as { failedMessageList?: readonly { statusCode?: string; statusMessage?: string }[] })
      ?.failedMessageList;
    const reason = failed?.[0] ? `${failed[0].statusCode ?? ""} ${failed[0].statusMessage ?? ""}`.trim() : String(e);
    console.warn(`[SMS] 알림톡 접수 거부 → 문자로 재발송 (${reason})`);
    await client.send(base);
  }
}

/* ─── 체크아웃 당일 안내 ────────────────────────── */
export async function sendCheckoutSMS(guest: { name: string; phone: string }) {
  if (!hasSolapi()) {
    console.warn("[SMS] 환경변수 미설정 — 체크아웃 안내 건너뜀");
    return;
  }
  await sendOne(guest.phone, buildCheckoutMessage(guest));
}

/* ─── 체크인 D-1 안내 ───────────────────────────── */
export async function sendCheckinReminderSMS(guest: {
  name: string;
  phone: string;
  room: string;
  checkIn: string;
  checkOut: string;
}) {
  if (!hasSolapi()) {
    console.warn("[SMS] 환경변수 미설정 — D-1 안내 건너뜀");
    return;
  }
  await sendOne(guest.phone, buildCheckinReminderMessage(guest));
}
