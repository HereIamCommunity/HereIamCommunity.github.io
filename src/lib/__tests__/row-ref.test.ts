import { describe, it, expect } from "vitest";
import {
  attachRowMeta,
  mergeBookingRowsWithMeta,
  normalizeRowRef,
  refCellRange,
  refRowRange,
} from "@/lib/row-ref";
import { parseStatusRequest } from "@/lib/admin-actions";

const HEADER = ["신청일시", "구분", "이름", "연락처"];

describe("normalizeRowRef", () => {
  it("살롱·스테이·리트릿·무료개방 탭과 2 이상의 행 번호를 받는다", () => {
    expect(normalizeRowRef({ tab: "스테이", rowNum: 12 })).toEqual({ tab: "스테이", rowNum: 12 });
    expect(normalizeRowRef({ tab: "살롱", rowNum: 2 })).toEqual({ tab: "살롱", rowNum: 2 });
    expect(normalizeRowRef({ tab: "리트릿", rowNum: 3 })).toEqual({ tab: "리트릿", rowNum: 3 });
    expect(normalizeRowRef({ tab: "무료개방", rowNum: 4 })).toEqual({ tab: "무료개방", rowNum: 4 });
  });

  it("헤더 행(1)과 0 이하는 거부한다", () => {
    expect(normalizeRowRef({ tab: "스테이", rowNum: 1 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이", rowNum: 0 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이", rowNum: -3 })).toBeNull();
  });

  it("모르는 탭·정수가 아닌 행 번호·빈 값은 거부한다", () => {
    expect(normalizeRowRef({ tab: "신청내역", rowNum: 5 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이!A1", rowNum: 5 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이", rowNum: 2.5 })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이", rowNum: "12" })).toBeNull();
    expect(normalizeRowRef({ tab: "스테이" })).toBeNull();
    expect(normalizeRowRef(undefined)).toBeNull();
    expect(normalizeRowRef(null)).toBeNull();
    expect(normalizeRowRef("스테이!12")).toBeNull();
  });
});

describe("ref → A1 범위", () => {
  it("예약 탭은 A~O, 리트릿은 A~M, 무료개방은 A~L 한 줄을 읽는다", () => {
    expect(refRowRange({ tab: "스테이", rowNum: 12 })).toBe("스테이!A12:O12");
    expect(refRowRange({ tab: "리트릿", rowNum: 7 })).toBe("리트릿!A7:M7");
    expect(refRowRange({ tab: "무료개방", rowNum: 5 })).toBe("무료개방!A5:L5");
  });

  it("셀 범위는 탭!열행", () => {
    expect(refCellRange({ tab: "살롱", rowNum: 9 }, "N")).toBe("살롱!N9");
    expect(refCellRange({ tab: "무료개방", rowNum: 3 }, "L")).toBe("무료개방!L3");
  });
});

describe("mergeBookingRowsWithMeta", () => {
  const salon = [HEADER, ["a1", "살롱", "김살롱", "010"], ["a2", "살롱", "이살롱", "010"]];
  const stay = [HEADER, ["b1", "스테이", "박스테이", ""], ["b2", "스테이", "최스테이", ""]];

  it("rows는 기존과 같이 헤더 1줄 + 살롱 데이터 + 스테이 데이터", () => {
    const { rows } = mergeBookingRowsWithMeta(salon, stay);
    expect(rows.map((r) => r[2])).toEqual(["이름", "김살롱", "이살롱", "박스테이", "최스테이"]);
  });

  it("meta는 rows와 같은 길이·같은 순서이고 시트 행 번호가 1-based다", () => {
    const { rows, meta } = mergeBookingRowsWithMeta(salon, stay);
    expect(meta).toHaveLength(rows.length);
    expect(meta).toEqual([
      { tab: "살롱", rowNum: 1 },
      { tab: "살롱", rowNum: 2 },
      { tab: "살롱", rowNum: 3 },
      { tab: "스테이", rowNum: 2 },
      { tab: "스테이", rowNum: 3 },
    ]);
  });

  it("연락처가 비어 있어도 행과 meta가 빠지지 않는다", () => {
    const { rows, meta } = mergeBookingRowsWithMeta([HEADER], [HEADER, ["", "스테이", "홍길동"]]);
    expect(rows).toHaveLength(2);
    expect(meta[1]).toEqual({ tab: "스테이", rowNum: 2 });
  });

  it("두 탭이 모두 비어 있으면 기본 헤더 한 줄 + meta 한 줄", () => {
    const { rows, meta } = mergeBookingRowsWithMeta([], []);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("신청일시");
    expect(meta).toEqual([{ tab: "살롱", rowNum: 1 }]);
  });
});

describe("attachRowMeta", () => {
  it("단일 탭은 인덱스+1이 행 번호", () => {
    expect(attachRowMeta([HEADER, ["x"], ["y"]], "리트릿")).toEqual([
      { tab: "리트릿", rowNum: 1 },
      { tab: "리트릿", rowNum: 2 },
      { tab: "리트릿", rowNum: 3 },
    ]);
  });

  it("빈 배열은 빈 meta", () => {
    expect(attachRowMeta([], "무료개방")).toEqual([]);
  });
});

describe("parseStatusRequest", () => {
  const base = { row: ["", "스테이", "홍길동", "", "", "", "여태방", "3", "2026-09-04", "2026-09-07"], action: "confirm" };

  it("연락처가 비어 있어도 통과한다 (행 번호로 처리 가능)", () => {
    const res = parseStatusRequest({ ...base, ref: { tab: "스테이", rowNum: 999 } });
    expect(res.ok).toBe(true);
    expect(res.ok && res.value.ref).toEqual({ tab: "스테이", rowNum: 999 });
    expect(res.ok && res.value.sheet).toBe("booking");
  });

  it("ref가 없어도 연락처 없는 행을 막지 않는다", () => {
    const res = parseStatusRequest(base);
    expect(res.ok).toBe(true);
    expect(res.ok && res.value.ref).toBeUndefined();
  });

  it("잘못된 ref는 무시하고 기존 탐색 경로로 둔다", () => {
    const res = parseStatusRequest({ ...base, ref: { tab: "없는탭", rowNum: 3 } });
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
