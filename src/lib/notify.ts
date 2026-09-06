/**
 * SMS 알림 (Solapi)
 *
 * 필요한 환경변수:
 *   SOLAPI_API_KEY       — Solapi 콘솔 > API Key
 *   SOLAPI_API_SECRET    — Solapi 콘솔 > API Secret
 *   SOLAPI_SENDER_PHONE  — 발신번호 (Solapi에 등록한 번호, 하이픈 없이)
 *
 * 예약 상태 알림(접수·확정·취소)은 src/lib/messaging.ts 의 notifyBooking 이 담당한다.
 * 이 파일은 cron 문자(체크인 D-1 · 체크아웃 당일)만 남긴다.
 */

import { SolapiMessageService } from "solapi";

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

/* ─── 체크아웃 당일 안내 SMS ────────────────────── */
export async function sendCheckoutSMS(guest: {
  name: string;
  phone: string;
}) {
  if (!hasSolapi()) {
    console.warn("[SMS] 환경변수 미설정 — 체크아웃 SMS 건너뜀");
    return;
  }

  const text = [
    `안녕하세요, ${guest.name}님.`,
    `기분 좋은 하루 시작하셨나요?`,
    ``,
    `코이노니아 체크아웃 메세지를 전해 드립니다.`,
    `체크아웃은 오전 11시까지입니다.`,
    `12시부터 클리닝 타임이 진행되니 체크아웃 시간을 지켜 주세요.`,
    ``,
    `▶ 스테이 경험 나누기`,
    `편안한 여정이 되셨다면, 구글맵에 코이노니아 리뷰를 남겨 주세요.`,
    ``,
    `▶ 안동 기념품 선물 및 구매 (1층 스토어)`,
    `안동의 물과 쌀을 빚어 만든 안동 소주, 일엽편주, 진맥소주, 진저 고유 등 우리 지역의 특산물을 소개하고 있습니다.`,
    ``,
    `▶ 러기지 서비스`,
    `여행하는 동안 코이노니아에 짐을 맡기실 수 있습니다. (캐리어당 5천원)`,
    ``,
    `코이노니아 스테이에 머물러 주셔서 진심으로 감사합니다.`,
    `안동에서 유쾌하고 행복한 시간 보내시길 바라요 😊`,
    ``,
    `문의: 010-2608-9144`,
    `코이노니아 드림`,
  ].join("\n");

  const client = getClient();
  await client.send({
    to: strip(guest.phone),
    from: strip(process.env.SOLAPI_SENDER_PHONE!),
    text,
  });
}

/* ─── 체크인 D-1 안내 SMS ───────────────────────── */
export async function sendCheckinReminderSMS(guest: {
  name: string;
  phone: string;
  room: string;
  checkIn: string;
  checkOut: string;
}) {
  if (!hasSolapi()) {
    console.warn("[SMS] 환경변수 미설정 — D-1 SMS 건너뜀");
    return;
  }

  const text = [
    `안녕하세요, ${guest.name}님.`,
    `내일은 코이노니아 스테이 체크인 날입니다.`,
    ``,
    `[입실 안내]`,
    `▶ 체크인: ${guest.checkIn} 15:00`,
    `▶ 체크아웃: ${guest.checkOut} 11:00`,
    `▶ 체크인 방법`,
    `1. 건물 외부에 있는 계단을 이용해 3층으로 올라옵니다.`,
    `2. 3층 출입문 비밀번호 : 3927*`,
    `3. 체크인 객실명을 확인 후 입실합니다.`,
    ``,
    `체크인은 오후 3시부터 10시까지 가능하며, 음주 상태에서 입실은 불가능합니다.`,
    `교통 이슈로 인해 밤 10시 이후에 입실할 경우 미리 호스트에게 메세지를 남겨 주세요.`,
    `체크아웃은 오전 11시이며, 레이트 체크아웃은 어렵습니다.`,
    ``,
    `[숙소 이용 안내]`,
    `숙소 이동 방법, 출입, 주차, 와이파이 정보와`,
    `안동 여행 정보를 상세하게 담은 스테이 가이드를 공유해 드립니다.`,
    `▶ 스테이 가이드`,
    `https://shorturl.at/ZCjqD`,
    ``,
    `[와이파이 안내]`,
    `▶ ID : Koinonia stay / PW: welcome2koinonia`,
    ``,
    `숙박과 관련해 궁금한 점이 있다면 010-2608-9144 로 언제든 편하게 연락 주세요.`,
    ``,
    `내일 뵙겠습니다! 설레는 안동 여행 되시길 바랍니다 🌿`,
    `반가운 마음을 담아, 코이노니아 드림`,
  ].join("\n");

  const client = getClient();
  await client.send({
    to: strip(guest.phone),
    from: strip(process.env.SOLAPI_SENDER_PHONE!),
    text,
  });
}
