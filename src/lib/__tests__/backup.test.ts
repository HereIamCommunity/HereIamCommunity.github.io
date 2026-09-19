import { describe, it, expect } from "vitest";
import { BACKUP_TABLES, BACKUP_WARN_BYTES, buildBackup, parseBackup, restorableRows } from "@/lib/backup";

const TABLES = {
  bookings: [{ id: 1, name: "홍", phone: "010", phone_digits: "010" }],
  retreats: [],
  open_stays: [{ id: 3 }],
  bulk_logs: [],
};
const NOW = new Date("2026-09-20T18:00:00Z"); // KST 2026-09-21 03:00

describe("buildBackup", () => {
  it("파일명은 KST 날짜, 네 테이블 건수를 센다", () => {
    const b = buildBackup(TABLES, NOW);
    expect(b.filename).toBe("koinonia-backup-2026-09-21.json");
    expect(b.counts).toEqual({ bookings: 1, retreats: 0, open_stays: 1, bulk_logs: 0 });
    expect(b.bytes).toBe(Buffer.byteLength(b.json));
    expect(b.tooLarge).toBe(false);
  });

  it("10MB를 넘으면 tooLarge", () => {
    const big = { ...TABLES, bookings: [{ id: 1, memo: "x".repeat(BACKUP_WARN_BYTES) }] };
    expect(buildBackup(big, NOW).tooLarge).toBe(true);
  });
});

describe("parseBackup", () => {
  it("buildBackup 결과를 그대로 읽는다", () => {
    expect(parseBackup(buildBackup(TABLES, NOW).json)).toEqual(TABLES);
  });

  it("버전·테이블이 없으면 거부 — 엉뚱한 파일로 복구하지 않게", () => {
    expect(() => parseBackup("{}")).toThrow(/백업 파일/);
    expect(() => parseBackup(JSON.stringify({ version: 1, tables: { bookings: [] } }))).toThrow(/retreats/);
    expect(() => parseBackup("not json")).toThrow();
  });
});

describe("restorableRows", () => {
  it("DB가 계산하는 phone_digits는 빼고 넣는다 (생성 컬럼에 값을 넣으면 오류)", () => {
    expect(restorableRows(TABLES.bookings)).toEqual([{ id: 1, name: "홍", phone: "010" }]);
  });
});

describe("BACKUP_TABLES", () => {
  it("네 테이블 전부", () => {
    expect([...BACKUP_TABLES]).toEqual(["bookings", "retreats", "open_stays", "bulk_logs"]);
  });
});
