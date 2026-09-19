import { describe, it, expect, beforeEach, vi } from "vitest";
import { FakeDb } from "./fake-db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase", () => ({ getDb: () => state.db }));

import {
  appendBulkLog,
  decodeSnapshot,
  findBulkLog,
  fromLogRecord,
  kstTimestamp,
  markBulkLogReverted,
  readBulkLog,
  toLogRecord,
  type BulkLogInput,
} from "@/lib/bulk-log";
import type { BulkSnapshotItem } from "@/lib/bulk";

const SNAP: BulkSnapshotItem[] = [
  { ref: { tab: "살롱", id: 2 }, status: "신청", notify: "" },
  { ref: { tab: "스테이", id: 12 }, status: "", notify: "✅ 10:00 접수" },
];

const entry: BulkLogInput = {
  jobId: "abc123abc123",
  at: "2026-09-10 14:32:05",
  filter: { usageBefore: "2026-09-10", status: "pending", type: "all" },
  action: "confirm",
  notify: false,
  count: 2,
  snapshot: SNAP,
  reverted: "",
};

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  state.db = db;
});

describe("레코드 변환", () => {
  it("toLogRecord → fromLogRecord 왕복", () => {
    expect(fromLogRecord({ id: 5, ...toLogRecord(entry) })).toEqual({ ...entry, id: 5 });
  });

  it("스냅샷이 깨졌으면 빈 배열 — 로그 한 줄 때문에 목록 전체가 죽지 않게", () => {
    expect(decodeSnapshot(null)).toEqual([]);
    expect(decodeSnapshot("oops")).toEqual([]);
    expect(decodeSnapshot([{ ref: { tab: "살롱", id: 0 }, status: "", notify: "" }])).toEqual([]); // 헤더 자리
    expect(decodeSnapshot([{ ref: { tab: "살롱", rowNum: 2 }, status: "", notify: "" }])).toEqual([]); // 시트 시절 모양
  });

  it("조건을 못 읽어도 되돌리기는 스냅샷만 있으면 된다", () => {
    const e = fromLogRecord({ id: 1, ...toLogRecord(entry), filter: null });
    expect(e.filter).toEqual({ status: "all", type: "all" });
    expect(e.snapshot).toEqual(SNAP);
  });
});

describe("DB 입출력", () => {
  it("기록 → jobId로 찾기 → 되돌림 표시", async () => {
    expect(await appendBulkLog(entry)).toBe(true);
    const found = await findBulkLog("abc123abc123");
    expect(found?.snapshot).toEqual(SNAP);
    expect(await markBulkLogReverted(found!.id, "2026-09-10 15:00:00")).toBe(1);
    expect((await findBulkLog("abc123abc123"))?.reverted).toBe("2026-09-10 15:00:00");
  });

  it("같은 jobId가 여럿이면 가장 최근 것 (되돌린 뒤 같은 대상을 다시 실행한 경우)", async () => {
    await appendBulkLog({ ...entry, reverted: "2026-09-10 15:00:00" });
    await appendBulkLog({ ...entry, at: "2026-09-10 16:00:00" });
    const found = await findBulkLog("abc123abc123");
    expect(found?.at).toBe("2026-09-10 16:00:00");
    expect(found?.reverted).toBe("");
  });

  it("최근 기록은 최신순, limit만큼", async () => {
    for (let i = 0; i < 3; i++) await appendBulkLog({ ...entry, jobId: `job${i}` });
    expect((await readBulkLog(2)).map((e) => e.jobId)).toEqual(["job2", "job1"]);
  });

  it("없으면 null, 환경변수가 없으면 기록하지 않고 false", async () => {
    expect(await findBulkLog("nope")).toBeNull();
    state.db = null;
    expect(await appendBulkLog(entry)).toBe(false);
  });

  it("읽기 오류는 던진다 — '기록 없음'으로 보이면 운영자가 재실행할 수 있다", async () => {
    db.failWith = { message: "boom" };
    await expect(findBulkLog("abc")).rejects.toEqual({ message: "boom" });
    await expect(readBulkLog()).rejects.toEqual({ message: "boom" });
  });
});

describe("kstTimestamp", () => {
  it("실제 시각을 KST 'YYYY-MM-DD HH:mm:ss'로", () => {
    expect(kstTimestamp(new Date("2026-09-10T05:32:05Z"))).toBe("2026-09-10 14:32:05");
  });
});
