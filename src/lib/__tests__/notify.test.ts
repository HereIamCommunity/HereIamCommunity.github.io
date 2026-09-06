import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { buildCheckinReminderMessage, buildCheckoutMessage } from "@/lib/notify";

/* ─── 솔라피 등록본 덤프 (읽기 전용 정답지) ─────── */
type DumpTemplate = { name: string; content: string; templateId: string };

const DUMP: DumpTemplate[] = JSON.parse(
  readFileSync(new URL("../../../phases/notify/solapi-templates.json", import.meta.url), "utf8")
);

function tpl(name: string): DumpTemplate {
  const found = DUMP.find((t) => t.name === name);
  if (!found) throw new Error(`덤프에 템플릿이 없다: ${name}`);
  return found;
}

function varsOf(content: string): string[] {
  return [...new Set(content.match(/#\{[^}]+\}/g) ?? [])].sort();
}

function render(content: string, values: Record<string, string>): string {
  return content.replace(/#\{[^}]+\}/g, (m) => values[m] ?? m);
}

const ENV_KEYS = ["KAKAO_PFID", "KAKAO_TEMPLATE_STAY_REMINDER", "KAKAO_TEMPLATE_STAY_CHECKOUT"];
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

const guest = { name: "이노니", checkIn: "2026-09-20", checkOut: "2026-09-22" };

const REMINDER_VARS = {
  "#{이름}": "이노니",
  "#{체크인날짜}": "2026-09-20",
  "#{체크아웃날짜}": "2026-09-22",
};

const CHECKOUT_VARS = { "#{이름}": "이노니" };

describe("buildCheckinReminderMessage — 7. 스테이 체크인 전날 D-1", () => {
  const name = "[스테이] 체크인 전날 D-1 (자동 발송)";

  it("템플릿 env가 있으면 변수 키가 등록본 본문과 정확히 일치한다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_STAY_REMINDER = "TPL_REMINDER";
    const msg = buildCheckinReminderMessage(guest);
    expect(Object.keys(msg.kakaoOptions!.variables).sort()).toEqual(varsOf(tpl(name).content));
    expect(msg.kakaoOptions!.variables).toEqual(REMINDER_VARS);
    expect(msg.kakaoOptions!.templateId).toBe("TPL_REMINDER");
    expect(msg.kakaoOptions!.disableSms).toBe(false);
  });

  it("본문이 등록본을 치환한 결과와 글자 단위로 같다", () => {
    expect(buildCheckinReminderMessage(guest).text).toBe(render(tpl(name).content, REMINDER_VARS));
  });

  it("템플릿 env가 없으면 kakaoOptions 없이 문자로만 나간다", () => {
    process.env.KAKAO_PFID = "PF123";
    const msg = buildCheckinReminderMessage(guest);
    expect(msg.kakaoOptions).toBeUndefined();
    expect(msg.text).toBe(render(tpl(name).content, REMINDER_VARS));
  });

  it("pfId가 없으면 템플릿 env가 있어도 kakaoOptions가 없다", () => {
    process.env.KAKAO_TEMPLATE_STAY_REMINDER = "TPL_REMINDER";
    expect(buildCheckinReminderMessage(guest).kakaoOptions).toBeUndefined();
  });
});

describe("buildCheckoutMessage — 8. 스테이 체크아웃 당일", () => {
  const name = "[스테이] 체크아웃 당일 (자동 발송)";

  it("템플릿 env가 있으면 변수 키가 등록본 본문과 정확히 일치한다", () => {
    process.env.KAKAO_PFID = "PF123";
    process.env.KAKAO_TEMPLATE_STAY_CHECKOUT = "TPL_CHECKOUT";
    const msg = buildCheckoutMessage({ name: "이노니" });
    expect(Object.keys(msg.kakaoOptions!.variables).sort()).toEqual(varsOf(tpl(name).content));
    expect(msg.kakaoOptions!.variables).toEqual(CHECKOUT_VARS);
    expect(msg.kakaoOptions!.templateId).toBe("TPL_CHECKOUT");
  });

  it("본문이 등록본을 치환한 결과와 글자 단위로 같다", () => {
    expect(buildCheckoutMessage({ name: "이노니" }).text).toBe(
      render(tpl(name).content, CHECKOUT_VARS)
    );
  });

  it("템플릿 env가 없으면 kakaoOptions 없이 문자로만 나간다", () => {
    process.env.KAKAO_PFID = "PF123";
    expect(buildCheckoutMessage({ name: "이노니" }).kakaoOptions).toBeUndefined();
  });
});
