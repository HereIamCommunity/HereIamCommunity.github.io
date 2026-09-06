import { describe, it, expect } from "vitest";
import { resolveStatusAction } from "@/lib/admin-actions";

describe("resolveStatusAction · booking", () => {
  it("빈 상태에서 confirm하면 입금확인 + 확정 알림", () => {
    expect(resolveStatusAction("booking", "", "confirm")).toEqual({
      ok: true, status: "입금확인", event: "confirmed",
    });
  });

  it("신청 상태에서 confirm하면 입금확인", () => {
    expect(resolveStatusAction("booking", "신청", "confirm")).toEqual({
      ok: true, status: "입금확인", event: "confirmed",
    });
  });

  it("이미 입금확인이면 409", () => {
    const res = resolveStatusAction("booking", "입금확인", "confirm");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.httpStatus).toBe(409);
  });

  it("결제완료 행은 confirm으로 내릴 수 없다 (409)", () => {
    const res = resolveStatusAction("booking", "결제완료", "confirm");
    expect(res.ok === false && res.httpStatus).toBe(409);
  });

  it("취소 행은 바로 confirm할 수 없다 (409)", () => {
    const res = resolveStatusAction("booking", "취소", "confirm");
    expect(res.ok === false && res.httpStatus).toBe(409);
  });

  it("cancel하면 취소 + 취소 알림", () => {
    expect(resolveStatusAction("booking", "신청", "cancel")).toEqual({
      ok: true, status: "취소", event: "cancelled",
    });
  });

  it("이미 취소면 409", () => {
    const res = resolveStatusAction("booking", "취소", "cancel");
    expect(res.ok === false && res.httpStatus).toBe(409);
  });

  it("취소를 reopen하면 신청으로 돌아가고 알림은 없다", () => {
    expect(resolveStatusAction("booking", "취소", "reopen")).toEqual({
      ok: true, status: "신청", event: null,
    });
  });

  it("입금확인도 reopen으로 신청으로 되돌린다", () => {
    expect(resolveStatusAction("booking", "입금확인", "reopen")).toEqual({
      ok: true, status: "신청", event: null,
    });
  });

  it("이미 신청·빈값이면 reopen은 409", () => {
    expect(resolveStatusAction("booking", "신청", "reopen").ok).toBe(false);
    expect(resolveStatusAction("booking", "", "reopen").ok).toBe(false);
  });

  it("앞뒤 공백이 있어도 같은 상태로 본다", () => {
    const res = resolveStatusAction("booking", " 입금확인 ", "confirm");
    expect(res.ok === false && res.httpStatus).toBe(409);
  });
});

describe("resolveStatusAction · retreat", () => {
  it("confirm은 입금확인, 알림 없음", () => {
    expect(resolveStatusAction("retreat", "신청", "confirm")).toEqual({
      ok: true, status: "입금확인", event: null,
    });
  });

  it("cancel은 취소, 알림 없음", () => {
    expect(resolveStatusAction("retreat", "입금확인", "cancel")).toEqual({
      ok: true, status: "취소", event: null,
    });
  });

  it("reopen은 신청", () => {
    expect(resolveStatusAction("retreat", "취소", "reopen")).toEqual({
      ok: true, status: "신청", event: null,
    });
  });

  it("같은 상태면 409", () => {
    expect(resolveStatusAction("retreat", "취소", "cancel").ok).toBe(false);
  });

  it("취소된 리트릿도 바로 confirm할 수 있다 (알림이 없어서)", () => {
    expect(resolveStatusAction("retreat", "취소", "confirm").ok).toBe(true);
  });
});

describe("resolveStatusAction · open", () => {
  it("confirm은 확정", () => {
    expect(resolveStatusAction("open", "신청", "confirm")).toEqual({
      ok: true, status: "확정", event: null,
    });
  });

  it("이미 확정이면 409", () => {
    expect(resolveStatusAction("open", "확정", "confirm").ok).toBe(false);
  });

  it("cancel은 취소, reopen은 신청", () => {
    expect(resolveStatusAction("open", "확정", "cancel")).toEqual({
      ok: true, status: "취소", event: null,
    });
    expect(resolveStatusAction("open", "확정", "reopen")).toEqual({
      ok: true, status: "신청", event: null,
    });
  });
});

describe("resolveStatusAction · 잘못된 입력", () => {
  it("모르는 action은 400", () => {
    const res = resolveStatusAction("booking", "신청", "delete");
    expect(res.ok === false && res.httpStatus).toBe(400);
  });

  it("모르는 sheet은 400", () => {
    const res = resolveStatusAction("workshop", "신청", "confirm");
    expect(res.ok === false && res.httpStatus).toBe(400);
  });
});
