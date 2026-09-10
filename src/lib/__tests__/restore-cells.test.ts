import { describe, it, expect } from "vitest";
import { parseRestoreRequest, toBatchData } from "@/lib/restore-cells";

describe("parseRestoreRequest", () => {
  it("정상 항목을 파싱하고 status/notify 기본값은 빈 문자열", () => {
    const r = parseRestoreRequest({ items: [{ ref: { tab: "살롱", rowNum: 5 }, status: "신청" }] });
    expect(r.ok && r.items).toEqual([{ ref: { tab: "살롱", rowNum: 5 }, status: "신청", notify: "" }]);
  });
  it("빈 배열·잘못된 ref·리트릿 탭은 거부", () => {
    expect(parseRestoreRequest({ items: [] }).ok).toBe(false);
    expect(parseRestoreRequest({ items: [{ ref: { tab: "살롱", rowNum: 1 } }] }).ok).toBe(false);
    expect(parseRestoreRequest({ items: [{ ref: { tab: "리트릿", rowNum: 3 } }] }).ok).toBe(false);
  });
});

describe("toBatchData", () => {
  it("행마다 N·O 두 셀", () => {
    const d = toBatchData([{ ref: { tab: "스테이", rowNum: 9 }, status: "", notify: "" }]);
    expect(d).toEqual([
      { range: "스테이!N9", values: [[""]] },
      { range: "스테이!O9", values: [[""]] },
    ]);
  });
});
