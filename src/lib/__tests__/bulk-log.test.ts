import { describe, it, expect } from "vitest";
import {
  BULK_LOG_HEADER,
  encodeSnapshot,
  decodeSnapshot,
  toLogRow,
  parseLogRow,
  kstTimestamp,
} from "@/lib/bulk-log";
import type { BulkSnapshotItem } from "@/lib/bulk";

const SNAP: BulkSnapshotItem[] = [
  { ref: { tab: "살롱", rowNum: 2 }, status: "신청", notify: "" },
  { ref: { tab: "스테이", rowNum: 12 }, status: "", notify: "✅ 10:00 접수" },
];

describe("스냅샷 직렬화", () => {
  it("왕복하면 원래 값 (99건 로그도 한 셀에 들어가게 배열로 압축)", () => {
    expect(decodeSnapshot(encodeSnapshot(SNAP))).toEqual(SNAP);
  });

  it("깨진 값은 빈 배열 — 로그 한 줄 때문에 목록 전체가 죽지 않게", () => {
    expect(decodeSnapshot("")).toEqual([]);
    expect(decodeSnapshot("{oops")).toEqual([]);
    expect(decodeSnapshot('[["살롱#0","신청",""]]')).toEqual([]); // 헤더 행 참조는 버린다
  });
});

describe("로그 행 왕복", () => {
  const entry = {
    jobId: "abc123abc123",
    at: "2026-09-10 14:32:05",
    filter: { usageBefore: "2026-09-10", status: "pending", type: "all" } as const,
    action: "confirm" as const,
    notify: false,
    count: 2,
    snapshot: SNAP,
    reverted: "",
  };

  it("열 개수가 헤더와 같다", () => {
    expect(toLogRow(entry)).toHaveLength(BULK_LOG_HEADER.length);
  });

  it("toLogRow → parseLogRow 왕복", () => {
    const parsed = parseLogRow(toLogRow(entry), 5);
    expect(parsed).toEqual({ ...entry, rowNum: 5 });
  });

  it("jobId가 없는 행(헤더·빈 줄)은 null", () => {
    expect(parseLogRow(BULK_LOG_HEADER, 1)).toBeNull();
    expect(parseLogRow([], 3)).toBeNull();
  });

  it("되돌림 시각이 있으면 reverted에 담긴다", () => {
    const row = toLogRow({ ...entry, reverted: "2026-09-10 15:00:00" });
    expect(parseLogRow(row, 7)?.reverted).toBe("2026-09-10 15:00:00");
  });
});

describe("kstTimestamp", () => {
  it("실제 시각을 KST 'YYYY-MM-DD HH:mm:ss'로", () => {
    expect(kstTimestamp(new Date("2026-09-10T05:32:05Z"))).toBe("2026-09-10 14:32:05");
  });
});
