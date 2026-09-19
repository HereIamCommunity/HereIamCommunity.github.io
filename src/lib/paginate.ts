/**
 * Supabase(PostgREST)는 한 번에 최대 1,000행만 돌려주고 나머지를 **에러 없이** 잘라낸다.
 * 1,000건을 넘는 순간 관리자 목록·통계·일괄 처리 대상·아침 리포트에서 오래된 건이 조용히 빠진다.
 * 그래서 전체 읽기는 반드시 이 함수로 끝까지 읽는다.
 *
 * `fetchPage`는 id 오름차순 조회에 `.range(from, to)`(to 포함)를 붙여 돌려줘야 한다.
 * 빈 페이지가 올 때까지 읽고, 받은 행 수만큼 from을 옮긴다 — 대시보드의 "Max rows"가
 * 1,000보다 작게 바뀌어도 잘리지 않는다.
 */

export const PAGE_SIZE = 1000;

export type PageResult<T> = { data: T[] | null; error: unknown };

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    if (page.length === 0) return out;
    out.push(...page);
    from += page.length;
  }
}
