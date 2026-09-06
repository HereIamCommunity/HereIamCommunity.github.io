import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildGuestMessage,
  buildHostMessage,
  isSendable,
  planMessages,
  fill,
  type Booking,
} from "@/lib/kakao";

/* ─── 솔라피 등록본 덤프 (읽기 전용 정답지) ─────── */
type DumpTemplate = { name: string; content: string; templateId: string };

const DUMP: DumpTemplate[] = JSON.parse(
  readFileSync(new URL("../../../phases/notify/solapi-templates.json", import.meta.url), "utf8")
);

/** 등록본을 이름으로 찾는다. */
function tpl(name: string): DumpTemplate {
  const found = DUMP.find((t) => t.name === name);
  if (!found) throw new Error(`덤프에 템플릿이 없다: ${name}`);
  return found;
}

/** 등록본 본문에서 실제로 쓰이는 #{...} 변수 집합 */
function varsOf(content: string): string[] {
  return [...new Set(content.match(/#\{[^}]+\}/g) ?? [])].sort();
}

/** 등록본 본문의 #{...}를 값으로 치환 (테스트용 독립 구현) */
function render(content: string, values: Record<string, string>): string {
  return content.replace(/#\{[^}]+\}/g, (m) => values[m] ?? m);
}

const ENV_KEYS = [
  "KAKAO_PFID",
  "KAKAO_TEMPLATE_SALON_RECEIVED",
  "KAKAO_TEMPLATE_SALON_CONFIRMED",
  "KAKAO_TEMPLATE_SALON_CANCELLED",
  "KAKAO_TEMPLATE_STAY_RECEIVED",
  "KAKAO_TEMPLATE_STAY_CONFIRMED",
  "KAKAO_TEMPLATE_STAY_CANCELLED",
  "KAKAO_TEMPLATE_STAY_REMINDER",
  "KAKAO_TEMPLATE_STAY_CHECKOUT",
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

/* ─── 게스트 6개 템플릿 × 등록본 대조 ───────────── */

type Case = {
  label: string;
  templateName: string;
  env: string;
  event: "received" | "confirmed" | "cancelled";
  booking: Booking;
  expected: Record<string, string>;
};

const CASES: Case[] = [
  {
    label: "1. 살롱 접수",
    templateName: "[살롱] 신청 접수 시",
    env: "KAKAO_TEMPLATE_SALON_RECEIVED",
    event: "received",
    booking: salon,
    expected: {
      "#{이름}": "김코이",
      "#{프로그램명}": "목요살롱 · 필사",
      "#{일시}": "2026-09-10 19:00",
      "#{금액}": "30,000",
    },
  },
  {
    label: "2. 살롱 확정",
    templateName: "[살롱] 입금 확인 후",
    env: "KAKAO_TEMPLATE_SALON_CONFIRMED",
    event: "confirmed",
    booking: salon,
    expected: {
      "#{이름}": "김코이",
      "#{프로그램명}": "목요살롱 · 필사",
      "#{일시}": "2026-09-10 19:00",
    },
  },
  {
    label: "3. 살롱 취소",
    templateName: "[살롱] 취소 시",
    env: "KAKAO_TEMPLATE_SALON_CANCELLED",
    event: "cancelled",
    booking: salon,
    expected: {
      "#{이름}": "김코이",
      "#{프로그램명}": "목요살롱 · 필사",
      "#{일시}": "2026-09-10 19:00",
    },
  },
  {
    label: "4. 스테이 접수",
    templateName: "[스테이] 예약 신청 접수 시",
    env: "KAKAO_TEMPLATE_STAY_RECEIVED",
    event: "received",
    booking: stay,
    expected: {
      "#{이름}": "이노니",
      "#{객실명}": "나그네방",
      "#{체크인날짜}": "2026-09-20",
      "#{체크아웃날짜}": "2026-09-22",
      "#{묵는일수}": "2",
      "#{금액}": "150,000",
    },
  },
  {
    label: "5. 스테이 확정",
    templateName: "[스테이] 입금 확인 후",
    env: "KAKAO_TEMPLATE_STAY_CONFIRMED",
    event: "confirmed",
    booking: stay,
    expected: {
      "#{이름}": "이노니",
      "#{객실명}": "나그네방",
      "#{체크인날짜}": "2026-09-20",
      "#{체크아웃날짜}": "2026-09-22",
      "#{묵는일수}": "2",
    },
  },
  {
    label: "6. 스테이 취소",
    templateName: "[스테이] 취소 시",
    env: "KAKAO_TEMPLATE_STAY_CANCELLED",
    event: "cancelled",
    booking: stay,
    expected: {
      "#{이름}": "이노니",
      "#{객실명}": "나그네방",
      "#{체크인시간}": "2026-09-20",
      "#{체크아웃시간}": "2026-09-22",
    },
  },
];

describe.each(CASES)("게스트 템플릿 $label", (c) => {
  beforeEach(() => {
    process.env.KAKAO_PFID = "PF123";
    process.env[c.env] = "TPL_ID";
  });

  it("변수 키가 등록본 본문의 #{...} 집합과 정확히 일치한다", () => {
    const msg = buildGuestMessage(c.event, c.booking);
    expect(Object.keys(msg.kakaoOptions!.variables).sort()).toEqual(varsOf(tpl(c.templateName).content));
  });

  it("변수 값이 예약 데이터 매핑대로 들어간다", () => {
    const msg = buildGuestMessage(c.event, c.booking);
    expect(msg.kakaoOptions!.variables).toEqual(c.expected);
  });

  it("문자 대체 문구가 등록본 본문을 치환한 결과와 글자 단위로 같다", () => {
    const msg = buildGuestMessage(c.event, c.booking);
    expect(msg.text).toBe(render(tpl(c.templateName).content, c.expected));
  });

  it("kakaoOptions에 pfId·templateId·disableSms가 들어간다", () => {
    const msg = buildGuestMessage(c.event, c.booking);
    expect(msg.kakaoOptions!.pfId).toBe("PF123");
    expect(msg.kakaoOptions!.templateId).toBe("TPL_ID");
    expect(msg.kakaoOptions!.disableSms).toBe(false);
  });

  it("템플릿 env가 없으면 kakaoOptions가 없다", () => {
    delete process.env[c.env];
    expect(buildGuestMessage(c.event, c.booking).kakaoOptions).toBeUndefined();
  });

  it("pfId가 없으면 kakaoOptions가 없다", () => {
    delete process.env.KAKAO_PFID;
    expect(buildGuestMessage(c.event, c.booking).kakaoOptions).toBeUndefined();
  });
});

describe("fill — #{키} 치환 헬퍼", () => {
  it("같은 변수가 여러 번 나와도 모두 치환한다", () => {
    expect(fill("a #{x} b #{x}", { "#{x}": "1" })).toBe("a 1 b 1");
  });

  it("값이 없는 변수는 그대로 둔다", () => {
    expect(fill("a #{y}", { "#{x}": "1" })).toBe("a #{y}");
  });
});

/* ─── 호스트 문안 ───────────────────────────────── */

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

  it("KAKAO_TEMPLATE_HOST는 선택 — 없으면 kakaoOptions 없이 문자로만 나간다", () => {
    process.env.KAKAO_PFID = "PF123";
    expect(buildHostMessage("received", salon).kakaoOptions).toBeUndefined();
  });

  it("KAKAO_TEMPLATE_HOST가 있으면 알림톡 옵션이 붙는다", () => {
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

/* ─── 발송 규칙 (순수 함수) ─────────────────────── */

describe("planMessages — 발송 대상 결정", () => {
  it("게스트 템플릿이 없으면 게스트도 호스트도 보내지 않는다", () => {
    const plan = planMessages("received", salon, { hasHostRecipient: true });
    expect(plan.guest).toBeUndefined();
    expect(plan.host).toBeUndefined();
  });

  it("게스트 템플릿이 있으면 게스트와 호스트를 함께 보낸다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_SALON_RECEIVED = "TPL_ID";
    const plan = planMessages("received", salon, { hasHostRecipient: true });
    expect(plan.guest?.kakaoOptions?.templateId).toBe("TPL_ID");
    expect(plan.host).toBeDefined();
  });

  it("호스트는 KAKAO_TEMPLATE_HOST가 없어도 문자로 나간다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_SALON_RECEIVED = "TPL_ID";
    const plan = planMessages("received", salon, { hasHostRecipient: true });
    expect(plan.host?.kakaoOptions).toBeUndefined();
    expect(plan.host?.text).toContain("새 신청");
  });

  it("호스트 수신번호가 없으면 게스트만 보낸다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_SALON_RECEIVED = "TPL_ID";
    const plan = planMessages("received", salon, { hasHostRecipient: false });
    expect(plan.guest).toBeDefined();
    expect(plan.host).toBeUndefined();
  });

  it("hostOnly면 게스트 템플릿이 있어도 호스트만 보낸다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_SALON_RECEIVED = "TPL_ID";
    const plan = planMessages("received", salon, { hostOnly: true, hasHostRecipient: true });
    expect(plan.guest).toBeUndefined();
    expect(plan.host).toBeDefined();
    expect(plan.host?.kakaoOptions).toBeUndefined();
  });

  it("hostOnly는 게스트 템플릿이 없어도 호스트를 문자로 보낸다", () => {
    const plan = planMessages("received", salon, { hostOnly: true, hasHostRecipient: true });
    expect(plan.host?.text).toContain("새 신청");
  });
});

describe("isSendable — 알림톡 옵션 유무", () => {
  it("kakaoOptions 없으면 false", () => {
    expect(isSendable({ text: "x" })).toBe(false);
  });
  it("kakaoOptions 있으면 true", () => {
    expect(
      isSendable({
        text: "x",
        kakaoOptions: { pfId: "p", templateId: "t", variables: {}, disableSms: false },
      })
    ).toBe(true);
  });
});
