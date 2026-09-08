import { describe, it, expect } from "vitest";
import { notifyStatusText } from "@/lib/messaging";

describe("notifyStatusText — O열 기록 형식", () => {
  it("성공은 '✅ HH:MM 접수' 24시간 표기다", () => {
    const text = notifyStatusText("received", { guest: "ok", host: "ok" });
    expect(text).toMatch(/^✅ \d{2}:\d{2} 접수$/);
  });

  it("확정 성공도 24시간 표기다", () => {
    const text = notifyStatusText("confirmed", { guest: "ok", host: "ok" });
    expect(text).toMatch(/^✅ \d{2}:\d{2} 확정$/);
  });

  it("오전/오후 같은 12시간 표기가 섞이지 않는다", () => {
    for (const event of ["received", "confirmed", "cancelled"] as const) {
      const text = notifyStatusText(event, { guest: "ok", host: "ok" });
      expect(text).not.toContain("오전");
      expect(text).not.toContain("오후");
    }
  });

  it("게스트 실패는 '❌ 확정 실패: 사유'", () => {
    const text = notifyStatusText("confirmed", { guest: { error: "잔액 부족" }, host: "ok" });
    expect(text).toBe("❌ 확정 실패: 잔액 부족");
  });

  it("호스트만 실패하면 뒤에 (호스트 ❌)를 덧붙인다", () => {
    const text = notifyStatusText("cancelled", { guest: "ok", host: { error: "번호 오류" } });
    expect(text).toMatch(/^✅ \d{2}:\d{2} 취소 \(호스트 ❌\)$/);
  });
});

describe("notifyStatusText — 연락처 없는 행", () => {
  it("건너뛴 사유가 있으면 괄호로 덧붙인다", () => {
    const text = notifyStatusText("confirmed", {
      guest: "skipped",
      host: "ok",
      guestSkipReason: "연락처 없음",
    });
    expect(text).toMatch(/^⏭ \d{2}:\d{2} 확정 건너뜀\(연락처 없음\)$/);
  });

  it("사유가 없으면 기존 문구 그대로", () => {
    const text = notifyStatusText("received", { guest: "skipped", host: "ok" });
    expect(text).toMatch(/^⏭ \d{2}:\d{2} 접수 건너뜀$/);
  });
});
