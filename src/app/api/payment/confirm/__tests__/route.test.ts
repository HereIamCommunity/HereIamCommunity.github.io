import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

import { POST } from "@/app/api/payment/confirm/route";

const realFetch = globalThis.fetch;
beforeEach(() => {
  mocks.appendBooking.mockReset();
  mocks.notifyBooking.mockReset();
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ paymentKey: "pk", orderId: "o1", method: "카드" }), { status: 200 })
  ) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("POST /api/payment/confirm", () => {
  it("결제 승인 후 저장한 행의 ref로 확정 알림을 기록한다", async () => {
    mocks.appendBooking.mockResolvedValue({ tab: "스테이", id: 7 });
    mocks.notifyBooking.mockResolvedValue({ guest: "ok", host: "ok" });

    const res = await POST(
      new NextRequest("http://localhost/api/payment/confirm", {
        method: "POST",
        body: JSON.stringify({
          paymentKey: "pk", orderId: "o1", amount: 240000,
          bookingData: { type: "stay", name: "홍", phone: "010-1", room: "옥순방" },
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.notifyBooking).toHaveBeenCalledWith(
      "confirmed",
      expect.objectContaining({ via: "toss" }),
      { ref: { tab: "스테이", id: 7 } }
    );
  });
});
