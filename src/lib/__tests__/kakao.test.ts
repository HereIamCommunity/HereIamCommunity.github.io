import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildGuestMessage,
  buildHostMessage,
  isSendable,
  kstStamp,
  planMessages,
  sendBookingMessages,
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
  it("게스트 템플릿이 없으면 게스트는 건너뛰고 호스트는 문자로 보낸다", () => {
    const plan = planMessages("received", salon, { hasHostRecipient: true });
    expect(plan.guest).toBeUndefined();
    expect(plan.host).toBeDefined();
    expect(plan.host?.kakaoOptions).toBeUndefined();
    expect(plan.host?.text).toContain("새 신청");
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

describe("호스트 문자 — 누가·언제·무엇을·어떤 액션", () => {
  const at = new Date("2026-09-07T00:12:00+09:00");

  it("kstStamp는 서버 TZ와 무관하게 KST 'M/D HH:MM'", () => {
    expect(kstStamp(at)).toBe("9/7 00:12");
    expect(kstStamp(new Date("2026-12-25T18:30:00+09:00"))).toBe("12/25 18:30");
    expect(kstStamp(new Date("2026-01-01T00:30:00+09:00"))).toBe("1/1 00:30");
  });

  it("첫 줄 문장 — 살롱/스테이 × 접수·입금확인·카드결제·취소", () => {
    const line = (ev: "received" | "confirmed" | "cancelled", b: Booking) =>
      buildHostMessage(ev, b, { at }).text.split("\n")[1];
    expect(line("received", { ...salon, via: "web" })).toBe("김코이님이 9/7 00:12에 살롱 예약을 신청했어요.");
    expect(line("received", { ...stay, via: "web" })).toBe("이노니님이 9/7 00:12에 스테이 예약을 신청했어요.");
    expect(line("confirmed", { ...salon, via: "admin" })).toBe("김코이님의 살롱 예약을 9/7 00:12에 입금확인 처리했어요.");
    expect(line("confirmed", { ...stay, via: "toss" })).toBe(
      "이노니님이 9/7 00:12에 스테이 요금을 카드로 결제했어요. 예약이 자동 확정됐어요."
    );
    expect(line("cancelled", { ...stay, via: "admin" })).toBe("이노니님의 스테이 예약을 9/7 00:12에 취소 처리했어요.");
  });

  it("헤더 — 카드결제는 '카드결제 완료', 그 외 이벤트 라벨", () => {
    expect(buildHostMessage("confirmed", { ...stay, via: "toss" }, { at }).text.split("\n")[0]).toBe("[코이노니아] 카드결제 완료 · 스테이");
    expect(buildHostMessage("confirmed", { ...salon, via: "admin" }, { at }).text.split("\n")[0]).toBe("[코이노니아] 입금확인 완료 · 살롱");
  });

  it("게스트 결과 안내 4분기", () => {
    const t = (r?: "ok" | "skipped" | { error: string }) => buildHostMessage("received", salon, { at, guestResult: r }).text;
    expect(t("ok")).toContain("게스트에게 안내 알림톡을 보냈어요.");
    expect(t("skipped")).toContain("게스트 알림은 아직 발송되지 않았어요 (템플릿 미설정).");
    expect(t({ error: "1042 유효한 템플릿 아이디가 아닙니다." })).toContain(
      "게스트 알림 발송 실패 (1042 유효한 템플릿 아이디가 아닙니다). 어드민에서 재발송해 주세요."
    );
    expect(t(undefined)).not.toContain("게스트");
  });

  it("다음 할 일 — 접수는 입금확인 안내, 취소는 환불 안내, 확정은 없음", () => {
    expect(buildHostMessage("received", salon, { at }).text).toContain("'입금확인'을 눌러주세요");
    expect(buildHostMessage("cancelled", salon, { at }).text).toContain("환불 처리가 필요해요");
    expect(buildHostMessage("confirmed", salon, { at }).text).not.toContain("눌러주세요");
    expect(buildHostMessage("received", salon, { at }).text).toContain("koinonia-web.vercel.app/admin");
  });
});

/* ─── 연락처 없는 행 (시트 수기 입력) ───────────── */
describe("연락처 없는 행", () => {
  const SOLAPI_KEYS = ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SENDER_PHONE", "OPERATOR_PHONE"];
  const savedSolapi: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of SOLAPI_KEYS) {
      savedSolapi[k] = process.env[k];
      delete process.env[k];
    }
    process.env.SOLAPI_API_KEY = "key";
    process.env.SOLAPI_API_SECRET = "secret";
    process.env.SOLAPI_SENDER_PHONE = "01000000000";
    // OPERATOR_PHONE은 비워 둔다 — 호스트 발송까지 건너뛰어 네트워크를 타지 않는다.
  });

  afterEach(() => {
    for (const k of SOLAPI_KEYS) {
      if (savedSolapi[k] === undefined) delete process.env[k];
      else process.env[k] = savedSolapi[k];
    }
  });

  it("연락처가 비면 게스트는 skipped이고 사유가 '연락처 없음'", async () => {
    const r = await sendBookingMessages("confirmed", { ...stay, phone: "" });
    expect(r.guest).toBe("skipped");
    expect(r.guestSkipReason).toBe("연락처 없음");
  });

  it("숫자가 하나도 없는 연락처도 연락처 없음으로 본다", async () => {
    const r = await sendBookingMessages("cancelled", { ...stay, phone: "-" });
    expect(r.guest).toBe("skipped");
    expect(r.guestSkipReason).toBe("연락처 없음");
  });

  it("호스트 문자는 '템플릿 미설정'이 아니라 연락처 없음을 알린다", () => {
    const text = buildHostMessage("confirmed", { ...stay, phone: "" }, {
      guestResult: "skipped",
      guestSkipReason: "연락처 없음",
    }).text;
    expect(text).toContain("연락처 없음");
    expect(text).not.toContain("템플릿 미설정");
  });
});
