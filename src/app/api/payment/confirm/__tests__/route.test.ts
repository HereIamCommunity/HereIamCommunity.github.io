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

  it("결제는 승인됐는데 예약 저장이 실패하면 수동 확인용 정보를 남기고 500", async () => {
    mocks.appendBooking.mockRejectedValue(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bookingData = { type: "stay", name: "홍", phone: "010-1", room: "옥순방" };

    const res = await POST(
      new NextRequest("http://localhost/api/payment/confirm", {
        method: "POST",
        body: JSON.stringify({ paymentKey: "pk", orderId: "o1", amount: 240000, bookingData }),
      })
    );

    expect(res.status).toBe(500);
    expect(errSpy).toHaveBeenCalledWith(
      "[PAYMENT] 결제는 승인됐지만 예약 저장 실패 — 수동 확인 필요",
      expect.objectContaining({ orderId: "o1", paymentKey: "pk", amount: 240000, bookingData })
    );
    expect(mocks.notifyBooking).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
