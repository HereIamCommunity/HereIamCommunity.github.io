import { describe, it, expect } from "vitest";
import { isBookingTab, normalizeRowRef } from "@/lib/row-ref";
import { parseStatusRequest } from "@/lib/admin-actions";

describe("normalizeRowRef", () => {
  it("살롱·스테이·리트릿·무료개방 탭과 1 이상의 DB id를 받는다", () => {
    expect(normalizeRowRef({ tab: "스테이", id: 12 })).toEqual({ tab: "스테이", id: 12 });
    expect(normalizeRowRef({ tab: "살롱", id: 1 })).toEqual({ tab: "살롱", id: 1 });
    expect(normalizeRowRef({ tab: "리트릿", id: 3 })).toEqual({ tab: "리트릿", id: 3 });
    expect(normalizeRowRef({ tab: "무료개방", id: 4 })).toEqual({ tab: "무료개방", id: 4 });
  });

  it("헤더 자리(0)와 음수는 거부한다", () => {
    expect(normalizeRowRef({ tab: "스테이", id: 0 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이", id: -3 })).toBeNull();
  });

  it("시트 시절 모양({tab,rowNum})은 거부한다 — 옛 화면이 보낸 행 번호를 id로 오해하지 않게", () => {
    expect(normalizeRowRef({ tab: "스테이", rowNum: 12 })).toBeNull();
  });

  it("모르는 탭·정수가 아닌 id·빈 값은 거부한다", () => {
    expect(normalizeRowRef({ tab: "신청내역", id: 5 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이!A1", id: 5 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이", id: 2.5 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이", id: "12" })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이" })).toBeNull();
    expect(normalizeRowRef(undefined)).toBeNull();
    expect(normalizeRowRef(null)).toBeNull();
    expect(normalizeRowRef("스테이!12")).toBeNull();
  });
});

describe("isBookingTab", () => {
  it("살롱·스테이만 예약 탭", () => {
    expect(isBookingTab("살롱")).toBe(true);
    expect(isBookingTab("스테이")).toBe(true);
    expect(isBookingTab("리트릿")).toBe(false);
    expect(isBookingTab("무료개방")).toBe(false);
  });
});

describe("parseStatusRequest", () => {
  const base = { row: ["", "스테이", "홍길동", "", "", "", "여태방", "3", "2026-09-04", "2026-09-07"], action: "confirm" };

  it("연락처가 비어 있어도 통과한다 (id로 처리 가능)", () => {
    const res = parseStatusRequest({ ...base, ref: { tab: "스테이", id: 999 } });
    expect(res.ok).toBe(true);
    expect(res.ok && res.value.ref).toEqual({ tab: "스테이", id: 999 });
    expect(res.ok && res.value.sheet).toBe("booking");
  });

  it("ref가 없어도 연락처 없는 행을 막지 않는다", () => {
    const res = parseStatusRequest(base);
    expect(res.ok).toBe(true);
    expect(res.ok && res.value.ref).toBeUndefined();
  });

  it("잘못된 ref는 무시하고 기존 탐색 경로로 둔다", () => {
    const res = parseStatusRequest({ ...base, ref: { tab: "없는탭", id: 3 } });
    expect(res.ok).toBe(true);
    expect(res.ok && res.value.ref).toBeUndefined();
  });

  it("row가 없거나 비면 400", () => {
    expect(parseStatusRequest({ action: "confirm" })).toEqual({
      ok: false, error: "신청 정보가 없습니다.", httpStatus: 400,
    });
    expect(parseStatusRequest({ row: [], action: "confirm" })).toEqual({
      ok: false, error: "신청 정보가 없습니다.", httpStatus: 400,
    });
  });

  it("모르는 동작은 400", () => {
    const res = parseStatusRequest({ ...base, action: "delete" });
    expect(res).toEqual({ ok: false, error: "알 수 없는 동작입니다.", httpStatus: 400 });
  });

  it("모르는 시트는 400", () => {
    const res = parseStatusRequest({ ...base, sheet: "unknown" });
    expect(res).toEqual({ ok: false, error: "알 수 없는 시트입니다.", httpStatus: 400 });
  });

  it("리트릿·무료개방 시트와 취소 사유를 그대로 넘긴다", () => {
    const res = parseStatusRequest({ ...base, sheet: "retreat", action: "cancel", reason: " 개인 사정 " });
    expect(res.ok && res.value.sheet).toBe("retreat");
    expect(res.ok && res.value.action).toBe("cancel");
    expect(res.ok && res.value.reason).toBe(" 개인 사정 ");
  });
});

describe("parseStatusRequest — notify 플래그", () => {
  const base = { row: ["", "살롱", "홍길동", "010-0000-0000"], action: "confirm" };
  it("기본은 true", () => {
    const r = parseStatusRequest(base);
    expect(r.ok && r.value.notify).toBe(true);
  });
  it("notify:false 면 false", () => {
    const r = parseStatusRequest({ ...base, notify: false });
    expect(r.ok && r.value.notify).toBe(false);
  });
  it("notify가 이상한 값이면 true (안전 기본값)", () => {
    const r = parseStatusRequest({ ...base, notify: "no" });
    expect(r.ok && r.value.notify).toBe(true);
  });
});
