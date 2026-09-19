import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  dumpAllTables: vi.fn(),
  sendOperatorNotice: vi.fn(),
  reportDbFailure: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ dumpAllTables: mocks.dumpAllTables }));
vi.mock("@/lib/email", () => ({ sendOperatorNotice: mocks.sendOperatorNotice }));
vi.mock("@/lib/db-alert", () => ({ reportDbFailure: mocks.reportDbFailure }));

import { GET } from "@/app/api/cron/weekly-backup/route";

const req = () =>
  new NextRequest("http://localhost/api/cron/weekly-backup", { headers: { authorization: "Bearer s3cret" } });

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  process.env.BACKUP_EMAIL = "backup@example.com";
  for (const m of Object.values(mocks)) m.mockReset();
});

describe("GET /api/cron/weekly-backup", () => {
  it("네 테이블을 JSON 첨부로 BACKUP_EMAIL에 보낸다", async () => {
    mocks.dumpAllTables.mockResolvedValue({ bookings: [{ id: 1 }], retreats: [], open_stays: [], bulk_logs: [] });
    mocks.sendOperatorNotice.mockResolvedValue(true);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(mocks.reportDbFailure).not.toHaveBeenCalled();

    const [subject, text, opts] = mocks.sendOperatorNotice.mock.calls[0];
    expect(subject).toContain("주간 백업");
    expect(text).toContain("bookings 1건");
    expect(opts.to).toBe("backup@example.com");
    const body = JSON.parse(opts.attachments[0].content.toString());
    expect(Object.keys(body.tables)).toEqual(["bookings", "retreats", "open_stays", "bulk_logs"]);
  });

  it("메일 설정이 없어 보내지 못했으면 성공이라 하지 않는다 — 경고 + 500", async () => {
    mocks.dumpAllTables.mockResolvedValue({ bookings: [], retreats: [], open_stays: [], bulk_logs: [] });
    mocks.sendOperatorNotice.mockResolvedValue(false);
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(mocks.reportDbFailure).toHaveBeenCalledWith("주간 백업 (메일 미설정)", expect.anything());
  });

  it("CRON_SECRET이 설정되지 않았으면 헤더 없이 401", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(new NextRequest("http://localhost/api/cron/weekly-backup"));
    expect(res.status).toBe(401);
    expect(mocks.dumpAllTables).not.toHaveBeenCalled();
  });

  it("실패하면 경고를 보내고 500", async () => {
    mocks.dumpAllTables.mockRejectedValue({ message: "paused" });
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(mocks.reportDbFailure).toHaveBeenCalledWith("주간 백업", { message: "paused" });
  });
});
