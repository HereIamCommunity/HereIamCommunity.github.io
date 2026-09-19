import { describe, it, expect } from "vitest";
import { fetchAllPages, PAGE_SIZE, type PageResult } from "@/lib/paginate";

/** 행 n개를 가진 가짜 테이블. 서버 상한(cap)을 넘는 요청은 cap만큼만 준다 — Supabase와 같다. */
function source(n: number, cap = 1000) {
  const all = Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number): Promise<PageResult<{ id: number }>> => {
    calls.push([from, to]);
    const size = Math.min(to - from + 1, cap);
    return { data: all.slice(from, from + size), error: null };
  };
  return { fetchPage, calls };
}

describe("fetchAllPages", () => {
  it("기본 페이지 크기는 1,000", () => {
    expect(PAGE_SIZE).toBe(1000);
  });

  it("2,500행을 하나도 빠짐없이 읽는다", async () => {
    const { fetchPage, calls } = source(2500);
    const rows = await fetchAllPages(fetchPage);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toEqual({ id: 2500 });
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999], [2500, 3499]]);
  });

  it("정확히 1,000행이면 다음 빈 페이지를 확인하고 멈춘다", async () => {
    const { fetchPage, calls } = source(1000);
    expect(await fetchAllPages(fetchPage)).toHaveLength(1000);
    expect(calls).toHaveLength(2);
  });

  it("빈 테이블은 빈 배열", async () => {
    const { fetchPage } = source(0);
    expect(await fetchAllPages(fetchPage)).toEqual([]);
  });

  it("서버 상한이 페이지 크기보다 작아도(300) 잘리지 않는다", async () => {
    const { fetchPage } = source(1234, 300);
    expect(await fetchAllPages(fetchPage)).toHaveLength(1234);
  });

  it("오류는 그대로 던진다 — 빈 결과로 위장하지 않는다", async () => {
    const boom = { message: "permission denied" };
    await expect(fetchAllPages(async () => ({ data: null, error: boom }))).rejects.toBe(boom);
  });
});
