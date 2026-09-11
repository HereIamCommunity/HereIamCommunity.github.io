import { describe, it, expect } from "vitest";
import {
  filterBookings,
  inPeriod,
  matchStatusFilter,
  bookingStatus,
  byCreatedDesc,
  type ListFilters,
} from "@/lib/list-filter";

/**
 * 목록 탭 필터 — 화면(ListTab·AdminShell)과 서버(`/api/admin/bulk`)가 같은 함수를 쓴다.
 * 여기서 깨지면 "목록 N건"과 일괄 처리 대상 건수가 어긋난다.
 *
 * 예약 행(A~O): 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수
 *               8체크인 9체크아웃 10할인 11결제금액 12요청사항 13상태 14알림
 */

const TODAY = "2026-09-10"; // 목요일

/** "2026-09-10" + 시각 → 시트 신청일시 표기 */
function created(iso: string, hhmm = "오후 2:00:00"): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}. ${m}. ${d}. ${hhmm}`;
}

function salon(name: string, createdISO: string, date: string, status = "신청"): string[] {
  const r = new Array(15).fill("");
  r[0] = created(createdISO);
  r[1] = "살롱"; r[2] = name; r[3] = "01011112222";
  r[4] = "프라이데이나잇"; r[5] = date; r[11] = "30000"; r[13] = status;
  return r;
}

function stay(name: string, createdISO: string, checkIn: string, status = "신청"): string[] {
  const r = new Array(15).fill("");
  r[0] = created(createdISO);
  r[1] = "스테이"; r[2] = name; r[3] = "01033334444";
  r[6] = "옥순방"; r[7] = "1"; r[8] = checkIn; r[9] = "2026-09-16";
  r[11] = "120000"; r[13] = status;
  return r;
}

const BASE: ListFilters = {
  period: "전체",
  typeFilter: "전체",
  statusFilter: "전체",
  searchInput: "",
};

const names = (rows: string[][], f: Partial<ListFilters>) =>
  filterBookings(rows, { ...BASE, ...f }, TODAY).map((r) => r[2]);

/* ── 기존 period 회귀 (동작 불변) ───────────────────── */

describe("inPeriod (신청일 기준 · 기존 4종)", () => {
  it("전체는 신청일을 못 읽어도 통과", () => {
    expect(inPeriod("", "전체", TODAY)).toBe(true);
    expect(inPeriod("손으로 넣은 행", "전체", TODAY)).toBe(true);
  });

  it("오늘은 신청일이 오늘인 행만", () => {
    expect(inPeriod(created("2026-09-10"), "오늘", TODAY)).toBe(true);
    expect(inPeriod(created("2026-09-09"), "오늘", TODAY)).toBe(false);
  });

  it("이번 주는 일요일부터 (2026-09-06 ~)", () => {
    expect(inPeriod(created("2026-09-06"), "이번 주", TODAY)).toBe(true);
    expect(inPeriod(created("2026-09-05"), "이번 주", TODAY)).toBe(false);
  });

  it("이번 달은 같은 YYYY-MM", () => {
    expect(inPeriod(created("2026-09-01"), "이번 달", TODAY)).toBe(true);
    expect(inPeriod(created("2026-08-31"), "이번 달", TODAY)).toBe(false);
  });

  it("전체가 아니면 신청일을 못 읽는 행은 제외", () => {
    expect(inPeriod("", "오늘", TODAY)).toBe(false);
  });
});

describe("matchStatusFilter · bookingStatus", () => {
  it("빈 N열은 '신청'으로 본다", () => {
    expect(bookingStatus(new Array(15).fill(""))).toBe("신청");
  });

  it("입금대기는 신청·빈값, 확정은 입금확인·결제완료·확정", () => {
    expect(matchStatusFilter("신청", "입금대기")).toBe(true);
    expect(matchStatusFilter("입금확인", "확정")).toBe(true);
    expect(matchStatusFilter("결제완료", "확정")).toBe(true);
    expect(matchStatusFilter("취소", "취소")).toBe(true);
    expect(matchStatusFilter("취소", "전체")).toBe(true);
    expect(matchStatusFilter("입금확인", "입금대기")).toBe(false);
  });
});

describe("filterBookings (기존 period 회귀)", () => {
  const ROWS = [
    salon("오늘살롱", "2026-09-10", "9월 20일 (일) 19:00"),
    salon("어제살롱", "2026-09-09", "9월 21일 (월) 19:00"),
    stay("지난달스테이", "2026-08-20", "2026-08-25", "입금확인"),
    salon("주초살롱", "2026-09-06", "9월 22일 (화) 19:00"),
  ];

  it("오늘", () => {
    expect(names(ROWS, { period: "오늘" })).toEqual(["오늘살롱"]);
  });

  it("이번 주 (일요일 시작)", () => {
    expect(names(ROWS, { period: "이번 주" })).toEqual(["오늘살롱", "어제살롱", "주초살롱"]);
  });

  it("이번 달", () => {
    expect(names(ROWS, { period: "이번 달" })).toEqual(["오늘살롱", "어제살롱", "주초살롱"]);
  });

  it("전체 · 구분 · 상태 · 검색", () => {
    expect(names(ROWS, {})).toHaveLength(4);
    expect(names(ROWS, { typeFilter: "스테이" })).toEqual(["지난달스테이"]);
    expect(names(ROWS, { statusFilter: "확정" })).toEqual(["지난달스테이"]);
    expect(names(ROWS, { searchInput: "주초" })).toEqual(["주초살롱"]);
  });

  it("신청일 내림차순으로 정렬한다", () => {
    expect(names(ROWS, {})).toEqual(["오늘살롱", "어제살롱", "주초살롱", "지난달스테이"]);
  });
});

describe("byCreatedDesc", () => {
  it("신청일을 못 읽는 행은 맨 아래", () => {
    const a = salon("A", "2026-09-01", "9월 5일 (토) 20:00");
    const bad = salon("B", "2026-09-02", "9월 6일 (일) 20:00");
    bad[0] = "";
    expect([bad, a].sort(byCreatedDesc).map((r) => r[2])).toEqual(["A", "B"]);
  });
});

/* ── 기간설정 ────────────────────────────────────── */

describe("filterBookings · 기간설정", () => {
  // 사용일: 살롱=일시(F), 스테이=체크인(I)
  const ROWS = [
    salon("경계시작", "2026-09-01", "2026-08-01 19:00"),
    salon("중간", "2026-09-02", "2026-08-20 19:00"),
    salon("경계끝", "2026-09-03", "2026-09-10 19:00"),
    salon("범위밖", "2026-09-04", "2026-09-11 19:00"),
    stay("스테이중간", "2026-08-05", "2026-08-15"),
    salon("사용일불명", "2026-09-05", ""),
  ];

  const range = (from?: string, to?: string, basis: "usage" | "created" = "usage") => ({
    period: "기간설정" as const,
    range: { basis, ...(from ? { from } : {}), ...(to ? { to } : {}) },
  });

  it("양끝을 포함한다", () => {
    expect(names(ROWS, range("2026-08-01", "2026-09-10"))).toEqual([
      "경계끝", "중간", "경계시작", "스테이중간",
    ]);
  });

  it("시작만 주면 그 이후 전부 (열린 구간)", () => {
    expect(names(ROWS, range("2026-09-10"))).toEqual(["범위밖", "경계끝"]);
  });

  it("종료만 주면 그 이전 전부 (열린 구간)", () => {
    expect(names(ROWS, range(undefined, "2026-08-15"))).toEqual(["경계시작", "스테이중간"]);
  });

  it("basis: created는 신청일로 자른다", () => {
    expect(names(ROWS, range("2026-09-02", "2026-09-04", "created"))).toEqual([
      "범위밖", "경계끝", "중간",
    ]);
  });

  it("basis: usage와 created는 다른 결과를 낸다", () => {
    const usage = names(ROWS, range("2026-08-01", "2026-08-31", "usage"));
    const createdNames = names(ROWS, range("2026-08-01", "2026-08-31", "created"));
    expect(usage).toEqual(["중간", "경계시작", "스테이중간"]);
    expect(createdNames).toEqual(["스테이중간"]);
  });

  it("기준 날짜를 못 읽는 행은 제외한다", () => {
    expect(names(ROWS, range("2026-01-01", "2026-12-31"))).not.toContain("사용일불명");
    const noCreated = salon("신청일불명", "2026-09-02", "2026-08-20 19:00");
    noCreated[0] = "";
    expect(names([...ROWS, noCreated], range("2026-01-01", "2026-12-31", "created"))).not.toContain(
      "신청일불명"
    );
  });

  it("구분·상태·검색 조건과 함께 적용된다", () => {
    expect(
      names(ROWS, { ...range("2026-08-01", "2026-09-10"), typeFilter: "스테이" })
    ).toEqual(["스테이중간"]);
  });

  it("range가 없으면 기간으로 거르지 않는다 (전체와 같다)", () => {
    expect(names(ROWS, { period: "기간설정" })).toHaveLength(ROWS.length);
  });

  it("결과는 신청일 내림차순 정렬을 유지한다", () => {
    expect(names(ROWS, range("2026-08-01", "2026-09-10"))).toEqual([
      "경계끝", "중간", "경계시작", "스테이중간",
    ]);
  });

  it("기간설정이 아니면 range는 무시된다", () => {
    expect(names(ROWS, { period: "전체", range: { basis: "usage", from: "2026-09-11" } })).toHaveLength(
      ROWS.length
    );
  });
});
