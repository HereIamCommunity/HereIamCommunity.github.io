/**
 * 카카오 알림톡 발송 (Solapi)
 *
 * 필요한 환경변수:
 *   SOLAPI_API_KEY       — Solapi 콘솔 > API Key
 *   SOLAPI_API_SECRET    — Solapi 콘솔 > API Secret
 *   SOLAPI_SENDER_PHONE  — 발신번호 (등록된 번호, ex: 01012345678)
 *   KAKAO_PFID           — 카카오 채널 PfId (비즈 채널 > 채널 관리 > pfid)
 *
 * 알림톡 템플릿:
 *   Solapi 콘솔 > 카카오 채널 > 알림톡 템플릿에서 아래 내용으로 등록 후 검수 통과 필요.
 *   템플릿 코드를 KAKAO_TEMPLATE_SALON / KAKAO_TEMPLATE_STAY 환경변수에 입력.
 */

import { SolapiMessageService } from "solapi";

function getClient() {
  return new SolapiMessageService(
    process.env.SOLAPI_API_KEY!,
    process.env.SOLAPI_API_SECRET!
  );
}

function stripHyphens(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

type SalonKakaoData = {
  name: string;
  phone: string;
  program: string;
  date: string;
  totalAmount: number;
};

type StayKakaoData = {
  name: string;
  phone: string;
  room: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
};

/**
 * 살롱 신청 확인 알림톡 발송
 *
 * 권장 템플릿 내용 (Solapi에 등록):
 * ──────────────────────────────────
 * 안녕하세요, #{name}님!
 * 코이노니아 살롱 신청이 접수됐어요 🎉
 *
 * 📌 신청 내역
 * 프로그램: #{program}
 * 일시: #{date}
 * 참가비: #{amount}원
 *
 * 아래 계좌로 입금해주시면 참가가 확정돼요.
 * 하나은행 5539-10-13844507 (코이노니아)
 * 입금자명: #{name}
 *
 * 입금 후 인스타그램 DM @koinonia_andong으로
 * 입금 완료를 알려주세요.
 * 확정 문자는 별도 발송되지 않습니다.
 *
 * 코이노니아에서 만나요! ☀️
 * ──────────────────────────────────
 */
export async function sendSalonKakao(data: SalonKakaoData) {
  if (!process.env.SOLAPI_API_KEY || !process.env.KAKAO_TEMPLATE_SALON) {
    console.warn("[Kakao] 환경변수 미설정 — 알림톡 발송 건너뜀");
    return;
  }

  const client = getClient();
  await client.send({
    to: stripHyphens(data.phone),
    from: process.env.SOLAPI_SENDER_PHONE!,
    kakaoOptions: {
      pfId: process.env.KAKAO_PFID!,
      templateId: process.env.KAKAO_TEMPLATE_SALON!,
      variables: {
        "#{name}": data.name,
        "#{program}": data.program,
        "#{date}": data.date,
        "#{amount}": data.totalAmount.toLocaleString(),
      },
    },
  });
}

/**
 * 스테이 예약 확인 알림톡 발송
 *
 * 권장 템플릿 내용 (Solapi에 등록):
 * ──────────────────────────────────
 * 안녕하세요, #{name}님!
 * 코이노니아 스테이 예약 신청이 접수됐어요 🏠
 *
 * 📌 예약 내역
 * 객실: #{room}
 * 체크인: #{checkIn}
 * 체크아웃: #{checkOut} (#{nights}박)
 * 총 입금액: #{amount}원
 *
 * 아래 계좌로 입금해주시면 예약이 확정돼요.
 * 하나은행 5539-10-13844507 (코이노니아)
 * 입금자명: #{name}
 *
 * 입금 후 인스타그램 DM @koinonia_andong으로
 * 입금 완료를 알려주세요.
 * 확정 안내는 입금 확인 후 전달드립니다.
 *
 * 안동에서 만나요! 🌿
 * ──────────────────────────────────
 */
export async function sendStayKakao(data: StayKakaoData) {
  if (!process.env.SOLAPI_API_KEY || !process.env.KAKAO_TEMPLATE_STAY) {
    console.warn("[Kakao] 환경변수 미설정 — 알림톡 발송 건너뜀");
    return;
  }

  const client = getClient();
  await client.send({
    to: stripHyphens(data.phone),
    from: process.env.SOLAPI_SENDER_PHONE!,
    kakaoOptions: {
      pfId: process.env.KAKAO_PFID!,
      templateId: process.env.KAKAO_TEMPLATE_STAY!,
      variables: {
        "#{name}": data.name,
        "#{room}": data.room,
        "#{checkIn}": data.checkIn,
        "#{checkOut}": data.checkOut,
        "#{nights}": String(data.nights),
        "#{amount}": data.totalAmount.toLocaleString(),
      },
    },
  });
}
