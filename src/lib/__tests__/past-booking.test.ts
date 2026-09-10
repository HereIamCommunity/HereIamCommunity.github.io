import { describe, it, expect } from "vitest";
import { usageDateISO, isPastBooking, GUEST_NOTIFY_CUTOFF } from "@/lib/past-booking";

const now = new Date("2026-09-10T12:00:00+09:00");

describe("usageDateISO — 사용일", () => {
  it("스테이는 체크인(I열)", () => {
    expect(usageDateISO({ type: "stay", checkIn: "2026-09-12" }, now)).toBe("2026-09-12");
    expect(usageDateISO({ type: "stay", checkIn: "2026. 9. 12." }, now)).toBe("2026-09-12");
  });
  it("살롱은 일시(F열) — 연도 없는 라벨은 now 연도", () => {
    expect(usageDateISO({ type: "salon", date: "9월 12일 (토) 20:00" }, now)).toBe("2026-09-12");
    expect(usageDateISO({ type: "salon", date: "2026-09-12 19:00" }, now)).toBe("2026-09-12");
  });
  it("판정 불가면 빈 문자열", () => {
    expect(usageDateISO({ type: "salon", date: "" }, now)).toBe("");
    expect(usageDateISO({ type: "stay" }, now)).toBe("");
  });
});

describe("isPastBooking — 2026-09-10 이전 사용일은 지난 예약", () => {
  it("cutoff 상수", () => expect(GUEST_NOTIFY_CUTOFF).toBe("2026-09-10"));
  it("이전 날짜는 true", () => {
    expect(isPastBooking({ type: "salon", date: "7월 24일 (금) 22:00" }, now)).toBe(true);
    expect(isPastBooking({ type: "stay", checkIn: "2026-09-09" }, now)).toBe(true);
  });
  it("당일·이후는 false", () => {
    expect(isPastBooking({ type: "stay", checkIn: "2026-09-10" }, now)).toBe(false);
    expect(isPastBooking({ type: "salon", date: "9월 12일 (토) 20:00" }, now)).toBe(false);
  });
  it("사용일을 모르면 false (보수적으로 발송)", () => {
    expect(isPastBooking({ type: "stay" }, now)).toBe(false);
  });
});
