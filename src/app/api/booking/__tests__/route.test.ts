import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  appendBooking: vi.fn(),
  notifyBooking: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ appendBooking: mocks.appendBooking }));
vi.mock("@/lib/messaging", () => ({ notifyBooking: mocks.notifyBooking }));
vi.mock("@/lib/email", () => ({
  sendOperatorAlert: vi.fn(async () => {}),
  sendGuestConfirmation: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/booking/route";

beforeEach(() => {
  mocks.appendBooking.mockReset();
  mocks.notifyBooking.mockReset();
});

describe("POST /api/booking", () => {
  it("저장한 행의 ref로 알림 결과를 기록한다 — 같은 연락처의 다른 예약에 붙지 않게", async () => {
    mocks.appendBooking.mockResolvedValue({ tab: "살롱", id: 42 });
    mocks.notifyBooking.mockResolvedValue({ guest: "ok", host: "ok" });

    const res = await POST(
      new NextRequest("http://localhost/api/booking", {
        method: "POST",
        body: JSON.stringify({ type: "salon", name: "홍", phone: "010-1", program: "p", totalAmount: 30000 }),
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.notifyBooking).toHaveBeenCalledWith(
      "received",
      expect.objectContaining({ name: "홍" }),
      { ref: { tab: "살롱", id: 42 } }
    );
  });

  it("저장을 건너뛰면(null) ref 없이 부른다", async () => {
    mocks.appendBooking.mockResolvedValue(null);
    mocks.notifyBooking.mockResolvedValue({ guest: "ok", host: "ok" });
    await POST(
      new NextRequest("http://localhost/api/booking", {
        method: "POST",
        body: JSON.stringify({ type: "stay", name: "홍", phone: "010-1", totalAmount: 1 }),
      })
    );
    expect(mocks.notifyBooking.mock.calls[0][2]).toEqual({ ref: undefined });
  });
});
