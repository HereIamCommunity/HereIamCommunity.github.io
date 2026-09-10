import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { notifyHost } from "@/lib/host-notify";
import type { Booking, SendResult } from "@/lib/kakao";

/**
 * 슬랙 → 문자 대체 분기.
 * fetch는 전부 모킹한다 — 슬랙에도 솔라피에도 실제로 나가지 않는다.
 * 문자 경로는 주입한 sendSms 콜백으로만 확인한다(솔라피 SDK를 부르지 않는다).
 */

const SLACK_KEYS = ["SLACK_BOT_TOKEN", "SLACK_CHANNEL_ID"];
const saved: Record<string, string | undefined> = {};

const booking: Booking = {
  type: "salon",
  name: "홍길동",
  phone: "010-1234-5678",
  program: "가을 살롱",
  date: "9월 20일 14:00",
  totalAmount: 30000,
};

function slackResponse(body: Record<string, unknown>) {
  return vi.fn(
    async (url: string | URL | Request) =>
      ({ ok: true, url: String(url), json: async () => body }) as unknown as Response
  );
}

beforeEach(() => {
  for (const k of SLACK_KEYS) {
    saved[k] = process.env[k];
  }
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
  process.env.SLACK_CHANNEL_ID = "C0TEST";
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of SLACK_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("notifyHost — 슬랙 성공", () => {
  it("채널은 slack이고 문자는 보내지 않는다", async () => {
    const fetchMock = slackResponse({ ok: true, ts: "1757000000.0001" });
    vi.stubGlobal("fetch", fetchMock);
    const sendSms = vi.fn(async (): Promise<SendResult> => "ok");

    const r = await notifyHost("received", booking, {}, sendSms);

    expect(r.channel).toBe("slack");
    expect(r.result).toBe("ok");
    expect(sendSms).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://slack.com/api/chat.postMessage");
  });
});

describe("notifyHost — 슬랙 실패", () => {
  it("슬랙이 error를 주면 문자로 대체한다", async () => {
    vi.stubGlobal("fetch", slackResponse({ ok: false, error: "not_in_channel" }));
    const sendSms = vi.fn(async (): Promise<SendResult> => "ok");

    const r = await notifyHost("confirmed", booking, {}, sendSms);

    expect(r.channel).toBe("sms");
    expect(r.result).toBe("ok");
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("fetch 자체가 던져도 문자로 대체한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      })
    );
    const sendSms = vi.fn(async (): Promise<SendResult> => "ok");

    const r = await notifyHost("cancelled", booking, {}, sendSms);

    expect(r.channel).toBe("sms");
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("문자도 실패하면 그 사유가 결과에 남는다", async () => {
    vi.stubGlobal("fetch", slackResponse({ ok: false, error: "channel_not_found" }));
    const sendSms = vi.fn(async (): Promise<SendResult> => ({ error: "1042 발송 실패" }));

    const r = await notifyHost("received", booking, {}, sendSms);

    expect(r.channel).toBe("sms");
    expect(r.result).toEqual({ error: "1042 발송 실패" });
  });
});

describe("notifyHost — 슬랙 미설정", () => {
  it("토큰·채널이 없으면 슬랙을 부르지 않고 문자로 간다", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_CHANNEL_ID;
    const fetchMock = slackResponse({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const sendSms = vi.fn(async (): Promise<SendResult> => "ok");

    const r = await notifyHost("received", booking, {}, sendSms);

    expect(r.channel).toBe("sms");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("토큰만 있고 채널이 없어도 미설정이다", async () => {
    delete process.env.SLACK_CHANNEL_ID;
    const fetchMock = slackResponse({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const r = await notifyHost("received", booking, {}, async () => "ok");

    expect(r.channel).toBe("sms");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("notifyHost — 문자 경로도 없을 때", () => {
  it("슬랙 미설정 + 호스트 수신번호 없음이면 channel none · skipped", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_CHANNEL_ID;
    const fetchMock = slackResponse({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const r = await notifyHost("received", booking, {});

    expect(r.channel).toBe("none");
    expect(r.result).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * sendBookingMessages가 호스트 분기를 notifyHost로 넘겼는지 — 결과에 hostChannel이 실려야
 * 어드민 토스트와 [NOTIFY] 로그가 채널을 구분할 수 있다.
 * 연락처 없음 + OPERATOR_PHONE 없음이라 솔라피는 한 번도 호출되지 않는다(슬랙 fetch만 모킹).
 */
describe("sendBookingMessages — 호스트 채널", () => {
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
    // OPERATOR_PHONE은 비워 둔다 — 문자 경로가 아예 없어 네트워크를 타지 않는다.
  });

  afterEach(() => {
    for (const k of SOLAPI_KEYS) {
      if (savedSolapi[k] === undefined) delete process.env[k];
      else process.env[k] = savedSolapi[k];
    }
  });

  it("슬랙이 성공하면 host=ok · hostChannel=slack", async () => {
    vi.stubGlobal("fetch", slackResponse({ ok: true, ts: "1.2" }));
    const { sendBookingMessages } = await import("@/lib/kakao");

    const r = await sendBookingMessages("received", { ...booking, phone: "" });

    expect(r.host).toBe("ok");
    expect(r.hostChannel).toBe("slack");
    expect(r.guest).toBe("skipped");
  });

  it("슬랙 미설정 + 호스트 번호 없음이면 hostChannel=none", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_CHANNEL_ID;
    const fetchMock = slackResponse({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { sendBookingMessages } = await import("@/lib/kakao");

    const r = await sendBookingMessages("received", { ...booking, phone: "" });

    expect(r.hostChannel).toBe("none");
    expect(r.host).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
