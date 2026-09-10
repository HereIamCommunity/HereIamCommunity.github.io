import { describe, it, expect } from "vitest";
import { isMissingRangeError } from "@/lib/sheets";

/**
 * 읽기 오류를 삼키면 "기록 없음"으로 위장돼 운영자가 되돌리기 대신 재실행할 수 있다.
 * 조용히 빈 배열로 넘겨도 되는 건 **탭이 아직 없을 때**뿐이다.
 */
describe("isMissingRangeError", () => {
  it("없는 탭을 가리킨 400은 true", () => {
    expect(isMissingRangeError({ status: 400, message: "Unable to parse range: '_bulk_log'!A:H" })).toBe(true);
  });

  it("googleapis가 감싼 형태(code + response.data.error)도 true", () => {
    expect(
      isMissingRangeError({
        code: 400,
        response: { data: { error: { code: 400, message: "Unable to parse range: '_bulk_log'!A:H" } } },
      })
    ).toBe(true);
  });

  it("권한·쿼터·그 밖의 오류는 false — 그대로 던져 500으로 드러낸다", () => {
    expect(isMissingRangeError({ status: 403, message: "The caller does not have permission" })).toBe(false);
    expect(isMissingRangeError({ status: 429, message: "Quota exceeded for quota metric 'Read requests'" })).toBe(false);
    expect(isMissingRangeError({ status: 400, message: "Invalid JSON payload received." })).toBe(false);
    expect(isMissingRangeError({ status: 500, message: "Internal error" })).toBe(false);
  });

  it("객체가 아니면 false", () => {
    expect(isMissingRangeError(undefined)).toBe(false);
    expect(isMissingRangeError("Unable to parse range")).toBe(false);
  });
});
