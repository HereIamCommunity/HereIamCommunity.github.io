import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkDbHealth: vi.fn(),
  reportDbFailure: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ checkDbHealth: mocks.checkDbHealth }));
vi.mock("@/lib/db-alert", () => ({ reportDbFailure: mocks.reportDbFailure }));

import { GET } from "@/app/api/cron/db-health/route";

const req = (auth?: string) =>
  new NextRequest("http://localhost/api/cron/db-health", {
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  mocks.checkDbHealth.mockReset();
  mocks.reportDbFailure.mockReset();
});

describe("GET /api/cron/db-health", () => {
  it("CRON_SECRET이 틀리면 401", async () => {
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect(mocks.checkDbHealth).not.toHaveBeenCalled();
  });

  it("정상이면 200과 점검한 테이블", async () => {
    mocks.checkDbHealth.mockResolvedValue({ ok: true, tables: ["bookings"] });
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checked: ["bookings"] });
    expect(mocks.reportDbFailure).not.toHaveBeenCalled();
  });

  it("실패하면 경고를 보내고 503", async () => {
    const err = { message: "project paused" };
    mocks.checkDbHealth.mockResolvedValue({ ok: false, table: "bookings", error: err });
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(503);
    expect(mocks.reportDbFailure).toHaveBeenCalledWith("매일 DB 점검 (bookings)", err);
  });
});
