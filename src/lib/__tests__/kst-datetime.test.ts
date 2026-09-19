import { describe, it, expect } from "vitest";
import { formatKstDateTime, kstTimestamp, parseKstDateTime } from "@/lib/kst-datetime";

/**
 * DB에는 실제 시각(timestamptz)을 넣는다. digest.ts의 parseSheetDateTime은
 * 서버 로컬 시간대 필드에 KST 벽시계를 담아서, Vercel(UTC)에서 그대로 넣으면 9시간 어긋난다.
 */
describe("parseKstDateTime", () => {
  it("오후 시각을 실제 시각(UTC)으로", () => {
    expect(parseKstDateTime("2026. 9. 6. 오후 7:10:32")?.toISOString()).toBe("2026-09-06T10:10:32.000Z");
  });

  it("오전 12시는 자정 — 날짜가 전날(UTC)로 넘어간다", () => {
    expect(parseKstDateTime("2026. 9. 6. 오전 12:05:00")?.toISOString()).toBe("2026-09-05T15:05:00.000Z");
  });

  it("오후 12시는 정오", () => {
    expect(parseKstDateTime("2026. 9. 6. 오후 12:00:00")?.toISOString()).toBe("2026-09-06T03:00:00.000Z");
  });

  it("형식이 다르거나 비면 null", () => {
    expect(parseKstDateTime("")).toBeNull();
    expect(parseKstDateTime("2026-09-06")).toBeNull();
    expect(parseKstDateTime(undefined as unknown as string)).toBeNull();
  });
});

describe("formatKstDateTime", () => {
  it("앱이 신청일시를 만들던 형식과 같다", () => {
    expect(formatKstDateTime(new Date("2026-09-19T06:04:05Z"))).toBe("2026. 9. 19. 오후 3:04:05");
  });

  it("parse → format 왕복하면 원래 문자열 (행 찾기가 이 문자열을 비교한다)", () => {
    for (const s of [
      "2026. 9. 6. 오후 7:10:32",
      "2026. 1. 1. 오전 12:00:00",
      "2026. 12. 31. 오후 11:59:59",
      "2026. 9. 6. 오후 12:30:00",
    ]) {
      expect(formatKstDateTime(parseKstDateTime(s)!)).toBe(s);
    }
  });
});

describe("kstTimestamp", () => {
  it("실제 시각을 KST 'YYYY-MM-DD HH:mm:ss'로", () => {
    expect(kstTimestamp(new Date("2026-09-10T05:32:05Z"))).toBe("2026-09-10 14:32:05");
  });
});
