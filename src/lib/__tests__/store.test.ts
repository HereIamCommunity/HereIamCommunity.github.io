import { describe, it, expect, beforeEach, vi } from "vitest";
import { FakeDb } from "./fake-db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase", () => ({ getDb: () => state.db }));
vi.mock("@/lib/db-alert", () => ({ reportDbFailure: vi.fn(async () => "slack") }));

import {
  appendBooking,
  appendBookingMemo,
  appendOpenStay,
  appendRetreat,
  applyPatches,
  checkDbHealth,
  getAllBookingsWithMeta,
  getAllRetreatsWithMeta,
  getBookingRow,
  getBookingsByPhone,
  getRetreatCounts,
  HEALTH_TABLES,
  updateBookingStatus,
  updateNotifyStatus,
  updateRetreatStatus,
} from "@/lib/store";

const CREATED_TEXT = "2026. 9. 6. 오후 7:10:32";
const CREATED_ISO = "2026-09-06T10:10:32.000Z";

function bookingRec(over: Record<string, unknown> = {}) {
  return {
    kind: "salon", created_at: CREATED_ISO, name: "김살롱", phone: "010-1111-2222",
    program: "프라이데이나잇", date_text: "9월 20일 (일) 19:00", room: "", nights: "",
    check_in: "", check_out: "", discount: "없음", total_amount: 30000, memo: "",
    status: "신청", notify_status: "", ...over,
  };
}

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  state.db = db;
});

describe("전체 읽기", () => {
  it("1,000건을 넘어도 모두 읽는다 (2,500건)", async () => {
    db.seed("bookings", Array.from({ length: 2500 }, (_, i) => bookingRec({ name: `n${i}` })));
    const { rows, meta } = await getAllBookingsWithMeta();
    expect(rows).toHaveLength(2501);
    expect(meta).toHaveLength(2501);
  });

  it("DB 오류는 빈 목록으로 위장하지 않고 던진다", async () => {
    db.failWith = { message: "boom" };
    await expect(getAllBookingsWithMeta()).rejects.toEqual({ message: "boom" });
  });

  it("리트릿 목록도 헤더 + meta", async () => {
    db.seed("retreats", [{ created_at: null, name: "a", phone: "1", session: "x", status: "신청" }]);
    const { rows, meta } = await getAllRetreatsWithMeta();
    expect(rows).toHaveLength(2);
    expect(meta[1].tab).toBe("리트릿");
  });

  it("환경변수가 없으면(클라이언트 null) 빈 목록", async () => {
    state.db = null;
    expect(await getAllBookingsWithMeta()).toEqual({ rows: [], meta: [] });
  });
});

describe("가짜 DB 스키마 (0001_init.sql과 동일해야 store.ts 버그를 잡는다)", () => {
  it("테이블에 없는 컬럼을 select하면 PostgREST처럼 42703 오류를 돌려준다", async () => {
    // retreats/open_stays에는 kind 컬럼이 없다 — bookings 전용 컬럼을 잘못 select하면 잡혀야 한다.
    const { data, error } = await db.from("retreats").select("id,kind");
    expect(data).toBeNull();
    expect(error).toMatchObject({ code: "42703" });
  });

  it("없는 컬럼에 insert/update해도 마찬가지로 오류", async () => {
    const insertErr = (await db.from("open_stays").insert({ kind: "salon" })).error;
    const updateErr = (await db.from("retreats").update({ kind: "salon" }).eq("id", 1)).error;
    expect(insertErr).toMatchObject({ code: "42703" });
    expect(updateErr).toMatchObject({ code: "42703" });
  });
});

describe("신청 저장", () => {
  it("새 행의 ref를 돌려주고, 신청일시는 실제 시각으로 저장한다", async () => {
    const ref = await appendBooking({
      type: "salon", createdAt: CREATED_TEXT, name: "홍", phone: "010-9", discount: "none",
      totalAmount: 30000, status: "신청",
    });
    expect(ref).toEqual({ tab: "살롱", id: 1 });
    expect(db.tables.bookings[0].created_at).toBe(CREATED_ISO);
  });

  it("리트릿·무료개방도 ref를 돌려준다 (두 테이블엔 kind 컬럼이 없다 — id만 select)", async () => {
    const r = await appendRetreat({
      createdAt: CREATED_TEXT, name: "a", phone: "b", grade: "c", region: "", session: "s1",
      referral: "", question: "", memo: "", allergy: "", care: "", parentNote: "", status: "신청",
    });
    const o = await appendOpenStay({
      createdAt: CREATED_TEXT, name: "a", phone: "b", email: "", checkIn: "", checkOut: "",
      groupType: "", groupSize: "", reason: "", contribution: "", message: "", status: "신청",
    });
    expect(r?.tab).toBe("리트릿");
    expect(o?.tab).toBe("무료개방");
    expect(db.tables.retreats[0].name).toBe("a");
    expect(db.tables.open_stays[0].name).toBe("a");
  });

  it("환경변수가 없으면 저장을 건너뛰고 null", async () => {
    state.db = null;
    expect(
      await appendBooking({ type: "salon", createdAt: "", name: "", phone: "", discount: "none", totalAmount: 0, status: "신청" })
    ).toBeNull();
  });

  it("저장 실패는 던진다", async () => {
    db.failWith = { message: "paused" };
    await expect(
      appendBooking({ type: "salon", createdAt: "", name: "", phone: "", discount: "none", totalAmount: 0, status: "신청" })
    ).rejects.toEqual({ message: "paused" });
  });
});

describe("행 찾기와 갱신", () => {
  beforeEach(() => {
    db.seed("bookings", [
      bookingRec({ id: 1, phone: "01011112222" }),
      bookingRec({ id: 2, phone: "010-1111-2222", created_at: "2026-09-07T01:00:00.000Z" }),
      bookingRec({ id: 3, kind: "stay", phone: "", name: "수기", created_at: null }),
    ]);
  });

  it("ref가 있으면 그 행 (연락처 없는 수기 행도)", async () => {
    const row = await getBookingRow("stay", "", "", { tab: "스테이", id: 3 });
    expect(row?.[2]).toBe("수기");
  });

  it("ref가 없으면 연락처 숫자로 찾고 신청일시가 같은 행을 우선한다", async () => {
    const row = await getBookingRow("salon", CREATED_TEXT, "010 1111 2222");
    expect(row?.[0]).toBe(CREATED_TEXT);
  });

  it("신청일시가 안 맞으면 같은 연락처의 최신 행", async () => {
    await updateBookingStatus("salon", "모름", "01011112222", "입금확인");
    expect(db.tables.bookings.find((r) => r.id === 2)?.status).toBe("입금확인");
    expect(db.tables.bookings.find((r) => r.id === 1)?.status).toBe("신청");
  });

  it("연락처도 ref도 없으면 찾지 않는다 (빈 연락처 수기 행을 잘못 잡지 않게)", async () => {
    expect(await getBookingRow("stay", "", "")).toBeNull();
  });

  it("알림 칸 기록", async () => {
    expect(await updateNotifyStatus("salon", "", "", "✅ 10:00 접수", { tab: "살롱", id: 1 })).toBe(true);
    expect(db.tables.bookings[0].notify_status).toBe("✅ 10:00 접수");
  });

  it("요청사항은 줄바꿈으로 이어 쓴다", async () => {
    await appendBookingMemo("salon", "", "", "[취소사유] 일정", { tab: "살롱", id: 1 });
    await appendBookingMemo("salon", "", "", "[취소사유] 또", { tab: "살롱", id: 1 });
    expect(db.tables.bookings[0].memo).toBe("[취소사유] 일정\n[취소사유] 또");
  });

  it("없는 ref면 연락처 경로로 떨어지고, 그것도 없으면 false", async () => {
    expect(await updateBookingStatus("salon", "", "", "취소", { tab: "살롱", id: 999 })).toBe(false);
  });
});

describe("리트릿", () => {
  it("다른 탭의 ref는 무시하고 연락처로 찾는다", async () => {
    db.seed("retreats", [{ id: 5, created_at: CREATED_ISO, name: "a", phone: "010-5", session: "", status: "신청" }]);
    expect(await updateRetreatStatus(CREATED_TEXT, "0105", "확정", { tab: "살롱", id: 5 })).toBe(true);
    expect(db.tables.retreats[0].status).toBe("확정");
  });

  it("인원 집계 오류는 0으로 채워 돌려준다 (신청 페이지가 죽지 않게)", async () => {
    db.failWith = { message: "boom" };
    const counts = await getRetreatCounts();
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });
});

describe("예약 확인", () => {
  it("연락처 숫자로 찾는다", async () => {
    db.seed("bookings", [bookingRec({ phone: "010-1111-2222" }), bookingRec({ phone: "010-9999-0000" })]);
    const res = await getBookingsByPhone("01011112222");
    expect(res).toHaveLength(1);
  });
});

describe("applyPatches", () => {
  it("DB 함수를 한 번만 부른다 (한 트랜잭션)", async () => {
    db.rpcResult = { data: 2, error: null };
    const n = await applyPatches([
      { ref: { tab: "살롱", id: 1 }, status: "입금확인" },
      { ref: { tab: "스테이", id: 2 }, status: "신청", notify: "" },
    ]);
    expect(n).toBe(2);
    expect(db.rpcCalls).toEqual([
      {
        fn: "apply_booking_patches",
        args: { patches: [{ id: 1, status: "입금확인" }, { id: 2, status: "신청", notify: "" }] },
      },
    ]);
  });

  it("빈 목록은 DB를 부르지 않는다", async () => {
    expect(await applyPatches([])).toBe(0);
    expect(db.rpcCalls).toEqual([]);
  });

  it("DB 오류(없는 id 등)는 던진다", async () => {
    db.rpcResult = { data: null, error: { message: "booking id 9 not found" } };
    await expect(applyPatches([{ ref: { tab: "살롱", id: 9 }, status: "x" }])).rejects.toEqual({
      message: "booking id 9 not found",
    });
  });
});

describe("checkDbHealth", () => {
  it("네 테이블을 모두 조회하면 ok", async () => {
    expect(await checkDbHealth()).toEqual({ ok: true, tables: [...HEALTH_TABLES] });
  });

  it("조회가 실패하면 그 테이블과 오류", async () => {
    db.failWith = { message: "paused" };
    expect(await checkDbHealth()).toEqual({ ok: false, table: "bookings", error: { message: "paused" } });
  });

  it("환경변수가 없으면 실패로 본다 (배포 설정 누락도 경고 대상)", async () => {
    state.db = null;
    const res = await checkDbHealth();
    expect(res.ok).toBe(false);
  });
});
