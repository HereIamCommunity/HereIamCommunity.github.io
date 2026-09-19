import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  postSlack: vi.fn(),
  sendOperatorNotice: vi.fn(),
}));
vi.mock("@/lib/slack", () => ({ postSlack: mocks.postSlack }));
vi.mock("@/lib/email", () => ({ sendOperatorNotice: mocks.sendOperatorNotice }));

import { DB_ALERT_THROTTLE_MS, reportDbFailure, resetDbAlertThrottle } from "@/lib/db-alert";

beforeEach(() => {
  resetDbAlertThrottle();
  mocks.postSlack.mockReset();
  mocks.sendOperatorNotice.mockReset();
});

describe("reportDbFailure", () => {
  it("슬랙이 되면 슬랙으로, 일시정지 확인 안내를 넣는다", async () => {
    mocks.postSlack.mockResolvedValue({ ok: true });
    expect(await reportDbFailure("예약 저장", new Error("fetch failed"), 1_000)).toBe("slack");
    const msg = mocks.postSlack.mock.calls[0][0];
    expect(msg.text).toContain("DB 연결 실패");
    expect(JSON.stringify(msg.blocks)).toContain("Restore");
    expect(JSON.stringify(msg.blocks)).toContain("fetch failed");
  });

  it("슬랙이 안 되면 운영자 메일로", async () => {
    mocks.postSlack.mockResolvedValue({ ok: false, error: "not-configured" });
    mocks.sendOperatorNotice.mockResolvedValue(undefined);
    expect(await reportDbFailure("예약 저장", { message: "paused" }, 1_000)).toBe("email");
    expect(mocks.sendOperatorNotice.mock.calls[0][0]).toContain("DB 연결 실패");
    expect(mocks.sendOperatorNotice.mock.calls[0][1]).toContain("paused");
  });

  it("10분 안에는 다시 보내지 않는다 (신청이 몰릴 때 폭탄 방지)", async () => {
    mocks.postSlack.mockResolvedValue({ ok: true });
    await reportDbFailure("a", "x", 1_000);
    expect(await reportDbFailure("b", "x", 1_000 + DB_ALERT_THROTTLE_MS - 1)).toBe("throttled");
    expect(await reportDbFailure("c", "x", 1_000 + DB_ALERT_THROTTLE_MS)).toBe("slack");
    expect(mocks.postSlack).toHaveBeenCalledTimes(2);
  });

  it("둘 다 실패해도 던지지 않는다 — 원래 오류 처리를 가리지 않게", async () => {
    mocks.postSlack.mockRejectedValue(new Error("net"));
    mocks.sendOperatorNotice.mockRejectedValue(new Error("mail"));
    expect(await reportDbFailure("a", "x", 1_000)).toBe("failed");
  });
});
