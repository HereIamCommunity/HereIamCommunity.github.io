import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildGuestMessage, buildHostMessage, isSendable, type Booking } from "@/lib/kakao";

const ENV_KEYS = [
  "KAKAO_PFID",
  "KAKAO_TEMPLATE_SALON_RECEIVED",
  "KAKAO_TEMPLATE_STAY_RECEIVED",
  "KAKAO_TEMPLATE_SALON_CONFIRMED",
  "KAKAO_TEMPLATE_STAY_CONFIRMED",
  "KAKAO_TEMPLATE_CANCELLED",
  "KAKAO_TEMPLATE_HOST",
];

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const salon: Booking = {
  type: "salon",
  name: "김코이",
  phone: "010-1234-5678",
  program: "목요살롱 · 필사",
  date: "2026-09-10 19:00",
  totalAmount: 30000,
};

const stay: Booking = {
  type: "stay",
  name: "이노니",
  phone: "01098765432",
  room: "나그네방",
  checkIn: "2026-09-20",
  checkOut: "2026-09-22",
  nights: 2,
  totalAmount: 150000,
};

describe("buildGuestMessage — 살롱 접수", () => {
  it("이름·프로그램·일시·금액이 문자 대체 문구에 들어간다", () => {
    const msg = buildGuestMessage("received", salon);
    expect(msg.text).toContain("김코이");
    expect(msg.text).toContain("목요살롱 · 필사");
    expect(msg.text).toContain("2026-09-10 19:00");
    expect(msg.text).toContain("30,000원");
    expect(msg.text).toContain("5539-10-13844507");
  });

  it("템플릿 env가 없으면 kakaoOptions가 없다", () => {
    expect(buildGuestMessage("received", salon).kakaoOptions).toBeUndefined();
  });

  it("템플릿 env가 있으면 kakaoOptions에 templateId와 변수가 들어간다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_SALON_RECEIVED = "TPL_SALON_RECV";
    const msg = buildGuestMessage("received", salon);
    expect(msg.kakaoOptions?.pfId).toBe("PF123");
    expect(msg.kakaoOptions?.templateId).toBe("TPL_SALON_RECV");
    expect(msg.kakaoOptions?.variables).toEqual({
      "#{name}": "김코이",
      "#{program}": "목요살롱 · 필사",
      "#{date}": "2026-09-10 19:00",
      "#{amount}": "30,000",
    });
    expect(msg.kakaoOptions?.disableSms).toBe(false);
  });

  it("pfId가 없으면 템플릿 env가 있어도 kakaoOptions가 없다", () => {
    process.env.KAKAO_TEMPLATE_SALON_RECEIVED = "TPL_SALON_RECV";
    expect(buildGuestMessage("received", salon).kakaoOptions).toBeUndefined();
  });
});

describe("buildGuestMessage — 스테이 접수", () => {
  it("객실·체크인·체크아웃·박수·금액이 문안에 들어간다", () => {
    const msg = buildGuestMessage("received", stay);
    expect(msg.text).toContain("나그네방");
    expect(msg.text).toContain("2026-09-20");
    expect(msg.text).toContain("2026-09-22");
    expect(msg.text).toContain("2박");
    expect(msg.text).toContain("150,000원");
  });

  it("변수 키가 템플릿 문안과 일치한다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_STAY_RECEIVED = "TPL_STAY_RECV";
    const msg = buildGuestMessage("received", stay);
    expect(msg.kakaoOptions?.templateId).toBe("TPL_STAY_RECV");
    expect(Object.keys(msg.kakaoOptions!.variables!).sort()).toEqual(
      ["#{amount}", "#{checkIn}", "#{checkOut}", "#{name}", "#{nights}", "#{room}"].sort()
    );
    expect(msg.kakaoOptions?.variables?.["#{nights}"]).toBe("2");
  });
});

describe("buildGuestMessage — 확정", () => {
  it("살롱 확정은 SALON_CONFIRMED 템플릿과 name/program/date 변수를 쓴다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_SALON_CONFIRMED = "TPL_SALON_CONF";
    const msg = buildGuestMessage("confirmed", salon);
    expect(msg.text).toContain("확정");
    expect(msg.kakaoOptions?.templateId).toBe("TPL_SALON_CONF");
    expect(msg.kakaoOptions?.variables).toEqual({
      "#{name}": "김코이",
      "#{program}": "목요살롱 · 필사",
      "#{date}": "2026-09-10 19:00",
    });
  });

  it("스테이 확정은 STAY_CONFIRMED 템플릿과 체크인·체크아웃 시간 안내를 담는다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_STAY_CONFIRMED = "TPL_STAY_CONF";
    const msg = buildGuestMessage("confirmed", stay);
    expect(msg.text).toContain("15:00");
    expect(msg.text).toContain("11:00");
    expect(msg.kakaoOptions?.templateId).toBe("TPL_STAY_CONF");
    expect(Object.keys(msg.kakaoOptions!.variables!).sort()).toEqual(
      ["#{checkIn}", "#{checkOut}", "#{name}", "#{nights}", "#{room}"].sort()
    );
  });
});

describe("buildGuestMessage — 취소", () => {
  it("살롱 취소는 type=살롱, detail=프로그램 / 일시", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_CANCELLED = "TPL_CANCEL";
    const msg = buildGuestMessage("cancelled", salon);
    expect(msg.text).toContain("취소");
    expect(msg.kakaoOptions?.templateId).toBe("TPL_CANCEL");
    expect(msg.kakaoOptions?.variables).toEqual({
      "#{name}": "김코이",
      "#{type}": "살롱",
      "#{detail}": "목요살롱 · 필사 / 2026-09-10 19:00",
    });
  });

  it("스테이 취소는 type=스테이, detail=객실 / 체크인 ~ 체크아웃", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_CANCELLED = "TPL_CANCEL";
    const msg = buildGuestMessage("cancelled", stay);
    expect(msg.kakaoOptions?.variables?.["#{type}"]).toBe("스테이");
    expect(msg.kakaoOptions?.variables?.["#{detail}"]).toBe("나그네방 / 2026-09-20 ~ 2026-09-22");
  });
});

describe("buildHostMessage", () => {
  it("이벤트별 라벨을 쓴다", () => {
    expect(buildHostMessage("received", salon).text).toContain("새 신청");
    expect(buildHostMessage("confirmed", salon).text).toContain("입금확인 완료");
    expect(buildHostMessage("cancelled", salon).text).toContain("취소 처리");
  });

  it("이름·연락처·금액이 문안에 들어간다", () => {
    const msg = buildHostMessage("received", stay);
    expect(msg.text).toContain("이노니");
    expect(msg.text).toContain("01098765432");
    expect(msg.text).toContain("150,000원");
  });

  it("HOST 템플릿과 6개 변수를 쓴다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_HOST = "TPL_HOST";
    const msg = buildHostMessage("confirmed", salon);
    expect(msg.kakaoOptions?.templateId).toBe("TPL_HOST");
    expect(msg.kakaoOptions?.variables).toEqual({
      "#{event}": "입금확인 완료",
      "#{type}": "살롱",
      "#{name}": "김코이",
      "#{phone}": "010-1234-5678",
      "#{detail}": "목요살롱 · 필사 / 2026-09-10 19:00",
      "#{amount}": "30,000",
    });
  });
});

describe("변수 키 형식", () => {
  it("모든 변수 키가 #{...} 형식이다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_SALON_RECEIVED = "A";
    process.env.KAKAO_TEMPLATE_STAY_RECEIVED = "B";
    process.env.KAKAO_TEMPLATE_SALON_CONFIRMED = "C";
    process.env.KAKAO_TEMPLATE_STAY_CONFIRMED = "D";
    process.env.KAKAO_TEMPLATE_CANCELLED = "E";
    process.env.KAKAO_TEMPLATE_HOST = "F";

    const events = ["received", "confirmed", "cancelled"] as const;
    for (const ev of events) {
      for (const booking of [salon, stay]) {
        for (const msg of [buildGuestMessage(ev, booking), buildHostMessage(ev, booking)]) {
          const keys = Object.keys(msg.kakaoOptions?.variables ?? {});
          expect(keys.length).toBeGreaterThan(0);
          for (const k of keys) expect(k).toMatch(/^#\{[a-zA-Z]+\}$/);
        }
      }
    }
  });
});

describe("isSendable — 템플릿 없으면 발송 안 함", () => {
  it("kakaoOptions 없으면 false", () => {
    expect(isSendable({ text: "x" })).toBe(false);
  });
  it("kakaoOptions 있으면 true", () => {
    expect(
      isSendable({ text: "x", kakaoOptions: { pfId: "p", templateId: "t", variables: {}, disableSms: false } })
    ).toBe(true);
  });
});
