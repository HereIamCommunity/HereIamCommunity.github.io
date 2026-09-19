# 구글 시트 → Supabase 이전 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 예약 데이터의 원본을 구글 시트에서 Supabase(Postgres)로 옮긴다. 신청·관리자·일괄 처리·cron 동작은 이전과 똑같이 유지한다.

**Architecture:** 어댑터 방식. `src/lib/store.ts`가 `src/lib/sheets.ts`를 대체하고, 같은 함수 이름과 같은 `string[][]` 행 모양을 돌려준다. 변환·매칭은 순수 모듈 `store-rows.ts`에, 쿼리는 `store.ts`에 둔다. 행 참조는 `{tab, rowNum}`에서 `{tab, id}`(DB 기본키)로 바뀐다. 일괄 처리는 Postgres 함수 한 번 호출(한 트랜잭션)로 반영한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest 4, `@supabase/supabase-js` v2, `server-only`, `tsx`(스크립트 실행), Resend, Slack Web API

**Spec:** `docs/superpowers/specs/2026-09-19-supabase-migration-design.md` (7장 "계획 작성 중 확정한 보완"이 본문보다 우선)

## Global Constraints

- Supabase가 원본이다. 구글 시트는 이전 후 보관용이며 앱은 시트를 읽거나 쓰지 않는다.
- 기존 순수 로직 테스트(`digest`, `stats`, `list-filter`, `bulk`, `past-booking`, `messaging`, `notify` 등)의 **기대값은 바꾸지 않는다.** `RowRef` 필드명(`rowNum` → `id`)과 `bulk`의 쓰기 형식(A1 범위 → 패치)만 반영한다.
- 브라우저는 Supabase에 직접 접근하지 않는다. 서버만 `SUPABASE_SERVICE_ROLE_KEY`로 접근한다. `NEXT_PUBLIC_` 접두어를 쓰지 않는다.
- 네 테이블 모두 RLS를 켜고 정책을 만들지 않는다.
- **전체 조회는 반드시 `fetchAllPages`를 거친다.** Supabase는 한 번에 최대 1,000행만 주고 나머지를 에러 없이 자른다.
- DB 오류를 "행 없음/빈 결과"로 위장하지 않는다. 그대로 던진다. 예외: `getRetreatCounts`만 기존처럼 오류 시 0으로 채운 결과를 돌려준다.
- 신청일시는 `ko-KR` 문자열(`"2026. 9. 6. 오후 7:10:32"`)로 주고받고, DB에는 `parseKstDateTime`으로 만든 실제 시각을 넣는다. `digest.ts`의 `parseSheetDateTime`을 DB 저장에 쓰지 않는다(서버 로컬 시간대라 Vercel에서 9시간 어긋난다).
- `supabase.ts`와 이를 거치는 모듈(`store.ts`, `bulk-log.ts`, `db-alert.ts`를 쓰는 라우트)은 `scripts/`에서 import하지 않는다. 스크립트는 순수 모듈(`paginate`, `store-rows`, `sheet-import`, `backup`, `kst-datetime`)과 자기 클라이언트만 쓴다. `bulk-log.ts`에서는 `import type`만 허용한다.
- 사용자에게 보이는 문구와 주석은 한국어로 쓰고, 주변 코드의 주석 밀도·말투를 따른다.
- 커밋 메시지 끝에 붙인다:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```

## 타입체크 상태 안내

Task 4에서 `RowRef` 필드명을 바꾸면 `sheets.ts`, `bulk-log.ts`, 일부 라우트가 Task 8까지 타입 오류를 낸다. **Task 4~7은 자기 테스트(`npx vitest run <파일>`)와 전체 `npm test`로 검증**하고, `npm run typecheck`는 Task 8에서 다시 통과시킨다. Task 8 이후 모든 Task는 `npm run typecheck`까지 통과해야 한다.

## 파일 구조

| 파일 | 상태 | 책임 |
|---|---|---|
| `supabase/migrations/0001_init.sql` | 새로 | 테이블 4개, RLS, `apply_booking_patches`, `reset_id_sequences` |
| `src/lib/kst-datetime.ts` | 새로 | 신청일시 문자열 ↔ 실제 시각, KST 타임스탬프 (순수) |
| `src/lib/paginate.ts` | 새로 | 1,000행 제한을 넘어 끝까지 읽기 (순수) |
| `src/lib/supabase.ts` | 새로 | 서버 전용 클라이언트 (`server-only`) |
| `src/lib/row-ref.ts` | 수정 | `RowRef = {tab, id}`, 시트 A1 함수 삭제 |
| `src/lib/bulk.ts` | 수정 | 쓰기 계획을 패치 목록으로 |
| `src/lib/store-rows.ts` | 새로 | DB 레코드 ↔ `string[]`, 입력 변환, 행 찾기 규칙 (순수) |
| `src/lib/store.ts` | 새로 | Supabase 쿼리 (`sheets.ts` 대체) |
| `src/lib/bulk-log.ts` | 수정 | `bulk_logs` 테이블 사용 |
| `src/lib/db-alert.ts` | 새로 | DB 실패 경고 (Slack → 이메일, 10분 제한) |
| `src/lib/backup.ts` | 새로 | 백업 파일 만들기·읽기 (순수) |
| `src/lib/sheet-import.ts` | 새로 | 시트 행 → DB 레코드 변환 (순수, 이전 스크립트 전용) |
| `src/lib/email.ts` | 수정 | `sendOperatorNotice` 추가 |
| `src/app/api/cron/db-health/route.ts` | 새로 | 매일 DB 점검 + 일시정지 방지 |
| `src/app/api/cron/weekly-backup/route.ts` | 새로 | 주간 백업 메일 |
| `scripts/migrate-sheets-to-supabase.ts` | 새로 | 시트 → DB 이전 |
| `scripts/restore-backup.ts` | 새로 | 백업 JSON → DB 복구 |
| `docs/runbook-supabase.md` | 새로 | 전환·일시정지·복구 절차 |
| `src/lib/sheets.ts`, `src/lib/__tests__/sheets.test.ts`, `google-apps-script/` | 삭제 | |
| 라우트 13개, 관리자 UI 4개 | 수정 | import 경로·ref 필드명 |

---

### Task 1: 의존성 추가 + KST 시각 모듈

**Files:**
- Modify: `package.json`
- Create: `src/lib/kst-datetime.ts`
- Test: `src/lib/__tests__/kst-datetime.test.ts`

**Interfaces:**
- Produces:
  - `parseKstDateTime(s: string): Date | null` — `ko-KR` 신청일시 문자열 → 실제 시각
  - `formatKstDateTime(d: Date): string` — 실제 시각 → `ko-KR` 신청일시 문자열
  - `kstTimestamp(now?: Date): string` — `"YYYY-MM-DD HH:mm:ss"` (KST). 지금 `bulk-log.ts`에 있는 함수를 이리로 옮긴다(Task 7에서 `bulk-log.ts`가 re-export).

- [ ] **Step 1: 의존성 설치**

```bash
npm install @supabase/supabase-js server-only
npm install -D tsx
```

Expected: `package.json`의 `dependencies`에 `@supabase/supabase-js`, `server-only`, `devDependencies`에 `tsx`가 추가된다.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/__tests__/kst-datetime.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatKstDateTime, kstTimestamp, parseKstDateTime } from "@/lib/kst-datetime";

/**
 * DB에는 실제 시각(timestamptz)을 넣는다. digest.ts의 parseSheetDateTime은
 * 서버 로컬 시간대 필드에 KST 벽시계를 담아서, Vercel(UTC)에서 그대로 넣으면 9시간 어긋난다.
 */
describe("parseKstDateTime", () => {
  it("오후 시각을 실제 시각(UTC)으로", () => {
    expect(parseKstDateTime("2026. 9. 6. 오후 7:10:32")?.toISOString()).toBe("2026-09-06T10:10:32.000Z");
  });

  it("오전 12시는 자정 — 날짜가 전날(UTC)로 넘어간다", () => {
    expect(parseKstDateTime("2026. 9. 6. 오전 12:05:00")?.toISOString()).toBe("2026-09-05T15:05:00.000Z");
  });

  it("오후 12시는 정오", () => {
    expect(parseKstDateTime("2026. 9. 6. 오후 12:00:00")?.toISOString()).toBe("2026-09-06T03:00:00.000Z");
  });

  it("형식이 다르거나 비면 null", () => {
    expect(parseKstDateTime("")).toBeNull();
    expect(parseKstDateTime("2026-09-06")).toBeNull();
    expect(parseKstDateTime(undefined as unknown as string)).toBeNull();
  });
});

describe("formatKstDateTime", () => {
  it("앱이 신청일시를 만들던 형식과 같다", () => {
    expect(formatKstDateTime(new Date("2026-09-19T06:04:05Z"))).toBe("2026. 9. 19. 오후 3:04:05");
  });

  it("parse → format 왕복하면 원래 문자열 (행 찾기가 이 문자열을 비교한다)", () => {
    for (const s of [
      "2026. 9. 6. 오후 7:10:32",
      "2026. 1. 1. 오전 12:00:00",
      "2026. 12. 31. 오후 11:59:59",
      "2026. 9. 6. 오후 12:30:00",
    ]) {
      expect(formatKstDateTime(parseKstDateTime(s)!)).toBe(s);
    }
  });
});

describe("kstTimestamp", () => {
  it("실제 시각을 KST 'YYYY-MM-DD HH:mm:ss'로", () => {
    expect(kstTimestamp(new Date("2026-09-10T05:32:05Z"))).toBe("2026-09-10 14:32:05");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/__tests__/kst-datetime.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/kst-datetime"`

- [ ] **Step 4: 구현**

`src/lib/kst-datetime.ts`:

```ts
/**
 * 신청일시 문자열 ↔ 실제 시각(instant) — 순수 함수, 서버 시간대와 무관.
 *
 * 앱은 신청일시를 `toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })` 형식
 * ("2026. 9. 6. 오후 7:10:32")으로 만들어 왔다. `digest.ts`의 `parseSheetDateTime`은
 * 이 문자열을 **서버 로컬 시간대** 필드에 담아 돌려준다(화면 계산용). DB에 넣을 실제 시각이
 * 필요할 때는 이 모듈을 쓴다 — Vercel(UTC)에서 parseSheetDateTime 결과를 그대로 넣으면 9시간 어긋난다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const PATTERN = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}):(\d{2})/;

/** "2026. 9. 6. 오후 7:10:32"(KST) → 실제 시각. 형식이 다르면 null. */
export function parseKstDateTime(s: string): Date | null {
  const m = (s ?? "").match(PATTERN);
  if (!m) return null;
  let h = Number(m[5]);
  if (m[4] === "오후" && h < 12) h += 12;
  if (m[4] === "오전" && h === 12) h = 0;
  const asUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, Number(m[6]), Number(m[7]));
  return new Date(asUtc - KST_OFFSET_MS);
}

/** 실제 시각 → "2026. 9. 6. 오후 7:10:32" (새 신청이 쓰던 형식 그대로) */
export function formatKstDateTime(d: Date): string {
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

/** 실제 시각 → KST "YYYY-MM-DD HH:mm:ss" (일괄 처리 로그·백업 파일명) */
export function kstTimestamp(now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  // sv-SE 로케일은 "2026-09-10 14:32:05" 형태를 준다.
  return p.format(now).replace("T", " ");
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/__tests__/kst-datetime.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/lib/kst-datetime.ts src/lib/__tests__/kst-datetime.test.ts
git commit -m "feat(store): Supabase 의존성 + KST 신청일시 변환 모듈

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 1,000행 제한을 넘는 전체 읽기

**Files:**
- Create: `src/lib/paginate.ts`
- Test: `src/lib/__tests__/paginate.test.ts`

**Interfaces:**
- Produces:
  - `type PageResult<T> = { data: T[] | null; error: unknown }`
  - `PAGE_SIZE = 1000`
  - `fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>, pageSize?: number): Promise<T[]>`
    - `fetchPage`는 `id` 오름차순 조회에 `.range(from, to)`(to 포함)를 붙여 돌려줘야 한다.
    - **빈 페이지가 올 때까지** 읽는다. 받은 행 수만큼 `from`을 옮긴다. 그래서 Supabase의 "Max rows" 설정이 1,000보다 작아도 잘리지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/paginate.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/paginate.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/paginate"`

- [ ] **Step 3: 구현**

`src/lib/paginate.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/paginate.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/paginate.ts src/lib/__tests__/paginate.test.ts
git commit -m "feat(store): 1,000행 제한을 넘어 끝까지 읽는 fetchAllPages

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: DB 스키마 + 서버 전용 클라이언트

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `src/lib/supabase.ts`
- Modify: `.env.example` (구글 시트 블록 위에 Supabase 블록 추가)
- Modify: `vitest.config.mts` (`server-only` 대체 모듈 alias)
- Create: `src/test/server-only-stub.ts`

**Interfaces:**
- Produces:
  - 테이블 `bookings`, `retreats`, `open_stays`, `bulk_logs` (컬럼은 아래 SQL 그대로)
  - DB 함수 `apply_booking_patches(patches jsonb) returns integer` — 원소 `{ id, status?, notify? }`, 없는 id가 있으면 전체 롤백
  - DB 함수 `reset_id_sequences() returns void`
  - `getDb(): SupabaseClient | null` — 환경변수가 없으면 null

- [ ] **Step 1: SQL 작성**

`supabase/migrations/0001_init.sql`:

```sql
-- 코이노니아 예약 데이터 (구글 시트 → Supabase 이전)
-- 설계: docs/superpowers/specs/2026-09-19-supabase-migration-design.md
-- 적용: Supabase 대시보드 > SQL Editor에 전체를 붙여넣고 Run. 한 번만 실행한다.

-- ── 예약 (살롱 + 스테이) ─────────────────────────────
create table public.bookings (
  id            bigint generated by default as identity primary key,
  sheet_row     integer,                -- 이전해 온 행의 원래 시트 행 번호. 새 행은 null
  kind          text not null check (kind in ('salon', 'stay')),
  created_at    timestamptz,            -- 수기 입력 행은 비어 있을 수 있다
  name          text not null default '',
  phone         text not null default '',
  phone_digits  text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  program       text not null default '',
  date_text     text not null default '',
  room          text not null default '',
  nights        text not null default '',
  check_in      text not null default '',
  check_out     text not null default '',
  discount      text not null default '',
  total_amount  integer,
  memo          text not null default '',
  status        text not null default '신청',
  notify_status text not null default '',
  unique (kind, sheet_row)
);
create index bookings_kind_created_idx on public.bookings (kind, created_at desc);
create index bookings_phone_digits_idx on public.bookings (phone_digits);

-- ── 리트릿 ───────────────────────────────────────────
create table public.retreats (
  id           bigint generated by default as identity primary key,
  sheet_row    integer unique,
  created_at   timestamptz,
  name         text not null default '',
  phone        text not null default '',
  phone_digits text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  grade        text not null default '',
  region       text not null default '',
  session      text not null default '',  -- 회차 라벨 문자열 (시트와 동일)
  referral     text not null default '',
  question     text not null default '',
  memo         text not null default '',
  allergy      text not null default '',
  care         text not null default '',
  parent_note  text not null default '',
  status       text not null default '신청'
);
create index retreats_phone_digits_idx on public.retreats (phone_digits);

-- ── 무료개방 ─────────────────────────────────────────
create table public.open_stays (
  id           bigint generated by default as identity primary key,
  sheet_row    integer unique,
  created_at   timestamptz,
  name         text not null default '',
  phone        text not null default '',
  phone_digits text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  email        text not null default '',
  check_in     text not null default '',
  check_out    text not null default '',
  group_type   text not null default '',
  group_size   text not null default '',
  reason       text not null default '',
  contribution text not null default '',
  message      text not null default '',
  status       text not null default '신청'
);
create index open_stays_phone_digits_idx on public.open_stays (phone_digits);

-- ── 일괄 처리 기록 ───────────────────────────────────
-- job_id는 unique가 아니다: 되돌린 뒤 같은 대상을 다시 실행하면 같은 jobId가 또 생긴다(조회는 최신 것).
create table public.bulk_logs (
  id          bigint generated by default as identity primary key,
  sheet_row   integer unique,
  job_id      text not null,
  at          text not null,             -- KST "YYYY-MM-DD HH:mm:ss"
  filter      jsonb not null,
  action      text not null,
  notify      boolean not null,
  count       integer not null,
  snapshot    jsonb not null,            -- [{ ref: {tab, id}, status, notify }]
  reverted_at text not null default ''
);
create index bulk_logs_job_id_idx on public.bulk_logs (job_id, id desc);

-- ── 보안: RLS 켜고 정책 없음 = anon/authenticated는 전부 거부. 서버만 service role로 접근 ──
alter table public.bookings   enable row level security;
alter table public.retreats   enable row level security;
alter table public.open_stays enable row level security;
alter table public.bulk_logs  enable row level security;
revoke all on table public.bookings, public.retreats, public.open_stays, public.bulk_logs
  from anon, authenticated;

-- ── 일괄 처리: 한 트랜잭션으로 전부 반영하거나 하나도 반영하지 않는다 ──
-- patches: [{ "id": 12, "status": "입금확인", "notify": "🔕 14:32 확정 알림 없음" }, ...]
-- 키가 없는 필드는 그대로 둔다. 빈 문자열은 빈 문자열로 쓴다(되돌리기에 필요).
create or replace function public.apply_booking_patches(patches jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  p jsonb;
  hit integer;
  total integer := 0;
begin
  for p in select * from jsonb_array_elements(patches) loop
    update public.bookings
       set status        = coalesce(p->>'status', status),
           notify_status = coalesce(p->>'notify', notify_status)
     where id = (p->>'id')::bigint;
    get diagnostics hit = row_count;
    if hit = 0 then
      raise exception 'booking id % not found', p->>'id';
    end if;
    total := total + hit;
  end loop;
  return total;
end;
$$;
revoke execute on function public.apply_booking_patches(jsonb) from public, anon, authenticated;
grant execute on function public.apply_booking_patches(jsonb) to service_role;

-- ── 백업 복구 후 id 시퀀스를 max(id)+1로 맞춘다 ──
create or replace function public.reset_id_sequences()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  t text;
begin
  foreach t in array array['bookings', 'retreats', 'open_stays', 'bulk_logs'] loop
    execute format(
      'select setval(pg_get_serial_sequence(%L, ''id''), coalesce((select max(id) from public.%I), 0) + 1, false)',
      'public.' || t, t
    );
  end loop;
end;
$$;
revoke execute on function public.reset_id_sequences() from public, anon, authenticated;
grant execute on function public.reset_id_sequences() to service_role;
```

- [ ] **Step 2: 서버 전용 클라이언트 작성**

`src/lib/supabase.ts`:

```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트 (service role — RLS를 우회한다).
 * 브라우저 번들에 들어가면 키가 새므로 `server-only`로 막는다.
 *
 * 환경변수가 없으면 null — 호출부는 시트 시절처럼 "저장 건너뜀 / 빈 결과"로 동작한다(로컬 개발용).
 */
let cached: SupabaseClient | null | undefined;

export function getDb(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return cached;
}
```

- [ ] **Step 3: `.env.example`에 Supabase 블록 추가**

`# ─── 구글 시트 ───` 줄 바로 위에 넣는다:

```
# ─── Supabase (예약 데이터 원본) ───────────────────
# 대시보드 > Project Settings > API
#   Project URL → SUPABASE_URL
#   service_role 키(또는 secret 키 sb_secret_…) → SUPABASE_SERVICE_ROLE_KEY
# 서버 전용. 절대 NEXT_PUBLIC_ 을 붙이지 않는다.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# 주간 백업(JSON 첨부) 받을 메일. 비우면 OPERATOR_EMAIL로 간다. 운영자 전용 메일함으로.
BACKUP_EMAIL=

```

- [ ] **Step 4: vitest에서 `server-only`를 빈 모듈로 바꾸기**

`server-only` 패키지는 React 서버 조건이 아닌 곳에서 불리면 무조건 오류를 낸다. Task 8부터 `messaging.ts` → `store.ts` → `supabase.ts` 경로로 기존 테스트(`messaging`, `bulk` 등)가 이 패키지를 부르게 되므로 **지금 막아둔다.** 앱 빌드(Next.js)에는 영향이 없다.

`src/test/server-only-stub.ts`:

```ts
// vitest(node)에서 `server-only` 대신 쓰는 빈 모듈. 실제 앱 빌드에는 영향이 없다.
export {};
```

`vitest.config.mts`의 `resolve.alias`를 바꾼다:

```ts
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
```

- [ ] **Step 5: 확인**

Run: `npx tsc --noEmit -p . 2>&1 | grep "src/lib/supabase.ts" || echo "supabase.ts OK"`
Expected: `supabase.ts OK`

Run: `npm test 2>&1 | tail -5`
Expected: 기존 테스트 모두 PASS (alias 추가가 아무것도 깨지 않는다)

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/0001_init.sql src/lib/supabase.ts .env.example vitest.config.mts src/test/server-only-stub.ts
git commit -m "feat(store): Supabase 스키마(RLS·트랜잭션 일괄처리 함수) + 서버 전용 클라이언트

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 행 참조를 DB id로 + 일괄 처리를 패치 목록으로

**Files:**
- Modify: `src/lib/row-ref.ts` (전체 교체)
- Modify: `src/lib/bulk.ts`
- Modify: `src/app/admin/_components/shared.ts:34-65`
- Modify: `src/app/admin/_components/BulkPanel.tsx:52,146`
- Modify: `src/app/admin/preview/page.tsx:129-132`
- Modify: `src/app/admin/page.tsx:26,162`
- Test: `src/lib/__tests__/row-ref.test.ts`, `src/lib/__tests__/bulk.test.ts`

**Interfaces:**
- Produces:
  - `type RowRef = { tab: SheetTab; id: number }` — 헤더 자리 meta는 `id: 0`
  - `normalizeRowRef(v: unknown): RowRef | null` — `id`가 1 이상 정수일 때만
  - `isBookingTab(tab: SheetTab): tab is "살롱" | "스테이"`
  - `type BookingPatch = { ref: RowRef; status?: string; notify?: string }` (row-ref.ts에 둔다 — bulk.ts와 store.ts가 같이 쓴다)
  - `BulkPlan.patches: BookingPatch[]` (`writes` 대신). 대상 한 건당 패치 하나.
  - `planRevertWrites(snapshot): BookingPatch[]` — 한 건당 `{ ref, status, notify }`
- 삭제: `refRowRange`, `refCellRange`, `TAB_LAST_COL`, `attachRowMeta`, `mergeBookingRowsWithMeta` (조립은 Task 5의 `store-rows.ts`로)

- [ ] **Step 1: row-ref 테스트를 새 계약으로 바꾸기**

`src/lib/__tests__/row-ref.test.ts`에서:
- import를 `import { isBookingTab, normalizeRowRef } from "@/lib/row-ref";`로 바꾼다.
- `describe("ref → A1 범위")`, `describe("mergeBookingRowsWithMeta")`, `describe("attachRowMeta")` 블록과 `HEADER` 상수를 삭제한다(Task 5의 `store-rows.test.ts`가 대신한다).
- `describe("normalizeRowRef")` 블록을 아래로 교체한다:

```ts
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
```

- `describe("parseStatusRequest")` 안의 ref를 바꾼다(기대값의 의미는 그대로):
  - `ref: { tab: "스테이", rowNum: 999 }` → `ref: { tab: "스테이", id: 999 }` (입력과 기대값 두 곳)
  - `ref: { tab: "없는탭", rowNum: 3 }` → `ref: { tab: "없는탭", id: 3 }`
  - 테스트 이름 `"연락처가 비어 있어도 통과한다 (행 번호로 처리 가능)"` → `"연락처가 비어 있어도 통과한다 (id로 처리 가능)"`

- [ ] **Step 2: bulk 테스트를 새 계약으로 바꾸기**

`src/lib/__tests__/bulk.test.ts`에서 **숫자는 그대로 두고 필드명만** 바꾼다. 헤더 자리만 0이 된다.

- `META`의 첫 원소 `{ tab: "살롱", rowNum: 1 }` → `{ tab: "살롱", id: 0 }`
- 나머지 모든 `rowNum: N` → `id: N` (`META`, `bulkJobId`의 `a`·`b`, `applied`·`snapshot` 기대값, `planRevertWrites` 입력)
- 294·297행 근처 `${META[i].rowNum}` / `${t.ref.rowNum}` → `${META[i].id}` / `${t.ref.id}`
- 주석 `// 살롱 탭 2~4행, 스테이 탭 2~4행 (헤더는 각 탭 1행)` → `// 살롱 id 2~4, 스테이 id 2~4 (헤더 자리는 id 0). 테스트에선 탭이 달라 id가 겹쳐도 된다.`
- `planBulkWrites`의 `writes` 기대값 4곳과 `planRevertWrites` 기대값을 아래로 교체한다:

```ts
  it("notify:false면 상태 + 알림(🔕 문구)을 한 패치로", () => {
    const p = planBulkWrites(targets.slice(0, 1), "confirm", false, AT);
    expect(p.patches).toEqual([
      { ref: { tab: "살롱", id: 2 }, status: "입금확인", notify: "🔕 14:32 확정 알림 없음" },
    ]);
  });

  it("notify:true면 상태만 쓴다 (알림 칸은 notifyBooking이 남긴다)", () => {
    const p = planBulkWrites(targets.slice(0, 1), "confirm", true, AT);
    expect(p.patches).toEqual([{ ref: { tab: "살롱", id: 2 }, status: "입금확인" }]);
  });

  it("reopen은 알림 이벤트가 없어 notify:false여도 알림 칸을 건드리지 않는다", () => {
    const t = selectBulkTargets(ROWS, META, { ...ALL, status: "confirmed" }, NOW);
    const p = planBulkWrites(t, "reopen", false, AT);
    expect(p.patches).toEqual([
      { ref: { tab: "스테이", id: 2 }, status: "신청" },
      { ref: { tab: "스테이", id: 4 }, status: "신청" },
    ]);
  });

  it("취소는 🔕 취소 알림 없음", () => {
    const p = planBulkWrites(targets.slice(0, 1), "cancel", false, AT);
    expect(p.patches[0].notify).toBe("🔕 14:32 취소 알림 없음");
  });
```

```ts
describe("planRevertWrites", () => {
  it("스냅샷 한 건당 상태·알림을 원값으로 되돌리는 패치 하나", () => {
    expect(
      planRevertWrites([{ ref: { tab: "스테이", id: 9 }, status: "", notify: "" }])
    ).toEqual([{ ref: { tab: "스테이", id: 9 }, status: "", notify: "" }]);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/__tests__/row-ref.test.ts src/lib/__tests__/bulk.test.ts`
Expected: FAIL — `isBookingTab is not a function`, `p.patches` undefined 등

- [ ] **Step 4: `src/lib/row-ref.ts` 전체 교체**

```ts
/**
 * 신청 행 참조(ref) — "탭 + DB id". 순수 로직.
 *
 * 배경: 연락처·신청일시가 빈 행(손으로 넣은 건)은 연락처로 찾을 수 없다.
 * 어드민 목록이 각 행의 ref(meta)를 함께 받아 두고, 상태 변경·재발송 때
 * 그 ref를 그대로 돌려주면 탐색 없이 정확한 행을 읽고 쓴다.
 *
 * 2026-09-19 Supabase 이전: 시트 행 번호(rowNum) 대신 DB 기본키(id)를 쓴다.
 * 살롱·스테이는 같은 `bookings` 테이블이라 id가 두 탭에 걸쳐 유일하다.
 * `SheetTab`이라는 이름은 화면·API 계약에 남아 있어 그대로 둔다.
 */

export type SheetTab = "살롱" | "스테이" | "리트릿" | "무료개방";

/** 행 참조. id는 DB 기본키(1 이상). 목록 meta의 헤더 자리에는 id 0이 온다. */
export type RowRef = { tab: SheetTab; id: number };

/** 어드민 목록 응답의 meta 원소 — ref와 같은 모양이다. */
export type RowMeta = RowRef;

/** 예약 한 건의 상태·알림 칸 변경. 키가 없는 칸은 그대로 둔다. */
export type BookingPatch = { ref: RowRef; status?: string; notify?: string };

/** 예약 목록(살롱·스테이) 헤더 — 화면이 열 순서를 이 배열로 안다. */
export const BOOKING_HEADER = [
  "신청일시","구분","이름","연락처","프로그램","일시","객실","박수","체크인","체크아웃","할인","결제금액","요청사항","상태","알림",
];

export function isSheetTab(v: unknown): v is SheetTab {
  return v === "살롱" || v === "스테이" || v === "리트릿" || v === "무료개방";
}

/** 예약 테이블(bookings)에 있는 탭인지 */
export function isBookingTab(tab: SheetTab): tab is "살롱" | "스테이" {
  return tab === "살롱" || tab === "스테이";
}

/**
 * 요청 body의 ref를 검증한다. 모르는 탭·헤더 자리(0)·정수가 아닌 id는 null.
 * null이면 호출부는 기존 탐색(연락처 매칭) 경로를 쓴다.
 */
export function normalizeRowRef(v: unknown): RowRef | null {
  if (!v || typeof v !== "object") return null;
  const { tab, id } = v as { tab?: unknown; id?: unknown };
  if (!isSheetTab(tab)) return null;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) return null;
  return { tab, id };
}
```

- [ ] **Step 5: `src/lib/bulk.ts` 수정**

1. 파일 머리 주석의 둘째 문단을 바꾼다:

```ts
 * 왜 순수하게 떼어놨나: 2026-09-10 운영에서 99건을 건별 API로 돌렸다가
 * 행마다 시트를 다시 읽어 **읽기 쿼터(429)** 에 걸렸다. 그래서 run은
 * `getAllBookingsWithMeta()` **읽기 1회** → `planBulkWrites` → `applyPatches` **쓰기 1회**로 끝낸다.
 * `applyPatches`는 DB 함수 한 번 호출이라 전부 반영되거나 하나도 반영되지 않는다(2026-09-19 Supabase 이전).
```

2. import 줄 `import { refCellRange, type RowMeta, type RowRef } from "@/lib/row-ref";`를 바꾼다:

```ts
import type { BookingPatch, RowMeta, RowRef } from "@/lib/row-ref";
```

3. `BulkPlan` 타입을 바꾼다:

```ts
export type BulkPlan = {
  /** `applyPatches`에 그대로 넘길 변경 목록 — 대상 한 건당 하나 */
  patches: BookingPatch[];
  snapshot: BulkSnapshotItem[];
  applied: RowRef[];
  skipped: { ref: RowRef; name: string; reason: string }[];
};
```

4. `selectBulkTargets`와 `selectBulkTargetsFromList`의 헤더 판정 두 곳:

```ts
    if (ref.id < 1) continue;                                      // 헤더 자리
```

그리고 `selectBulkTargets` 주석의 `- 헤더 행(meta.rowNum < 2)` → `- 헤더 자리(meta.id < 1)`

5. `bulkJobId`의 키:

```ts
    .map((r) => `${r.tab}#${r.id}`)
```

6. `planBulkWrites`와 `planRevertWrites`를 교체한다:

```ts
/**
 * 대상마다 `resolveStatusAction`으로 허용 여부를 판정해 적용/스킵을 나누고,
 * `applyPatches` 한 번에 넘길 변경 목록을 만든다.
 *
 * - notify:false + 알림이 있는 액션(confirm·cancel) → 알림 칸에 `🔕 HH:MM … 알림 없음`
 * - notify:true → 상태만. 알림 칸은 발송 후 `notifyBooking` 결과로 남긴다.
 * - 스냅샷은 **적용된 행만**, 쓰기 전 상태·알림 원값 그대로(되돌리기의 원천).
 */
export function planBulkWrites(
  targets: BulkTarget[],
  action: BulkAction,
  notify: boolean,
  now: Date = new Date()
): BulkPlan {
  const plan: BulkPlan = { patches: [], snapshot: [], applied: [], skipped: [] };

  for (const t of targets) {
    const resolved = resolveStatusAction("booking", t.status, action);
    if (!resolved.ok) {
      plan.skipped.push({ ref: t.ref, name: t.name, reason: resolved.error });
      continue;
    }

    const patch: BookingPatch = { ref: t.ref, status: resolved.status };
    if (!notify && resolved.event) patch.notify = silentStatusText(resolved.event, now);
    plan.patches.push(patch);

    plan.snapshot.push({ ref: t.ref, status: t.status, notify: t.notify });
    plan.applied.push(t.ref);
  }

  return plan;
}

/** 스냅샷을 그대로 되돌리는 변경 목록 — 한 건당 상태·알림 두 칸. */
export function planRevertWrites(snapshot: BulkSnapshotItem[]): BookingPatch[] {
  return snapshot.map((s) => ({ ref: s.ref, status: s.status, notify: s.notify }));
}
```

7. `BulkTarget`의 필드 주석 `/** N열 원값 */`, `/** O열 원값 */` → `/** 상태 원값 */`, `/** 알림 원값 */`. `BulkSnapshotItem` 주석 `쓰기 직전의 N·O 원값` → `쓰기 직전의 상태·알림 원값`.

8. `BULK_LOG_REQUIRED_ERROR`와 `canApplyBulkWrites` 주석을 바꾼다:

```ts
export const BULK_LOG_REQUIRED_ERROR =
  "실행 기록을 남기지 못해 중단했습니다. DB 연결 상태를 확인하세요.";

/**
 * 상태를 바꿔도 되는지 (순수 판정).
 *
 * 되돌리기의 **유일한** 근거가 `bulk_logs`의 스냅샷이다. 로그가 안 남았는데 상태를 바꾸면
 * 최대 500행이 되돌릴 수 없는 상태가 된다 — 그래서 쓰기 **전에** 막는다.
 * 적용할 행이 0건이면 바꿀 것도 없으므로 로그 없이 통과.
 */
```

9. 파일 머리 주석 `시트 I/O·네트워크 없음` → `DB I/O·네트워크 없음`.

- [ ] **Step 6: 관리자 UI 수정**

`src/app/admin/_components/shared.ts`:

```ts
/* ── 행 참조 레지스트리 (6.1 계약, 2026-09-19부터 DB id) ─────────
   행은 화면 전체에서 `string[]` 그대로 흘러다니고 digest·필터·정렬이 같은 배열 참조를
   유지한다. ref를 프롭으로 나르면 컴포넌트 8곳의 시그니처가 전부 바뀌므로,
   행 배열의 정체성에 WeakMap으로 붙여 둔다. 등록은 데이터를 받은 쪽(page/preview)이 한 번만 한다. */
const REF_BY_ROW = new WeakMap<Row, RowRef>();

/**
 * `meta`를 원본 행 배열(헤더 포함)에 붙인다.
 * meta가 헤더를 포함하든(length === rawRows.length) 빼든(length === rawRows.length - 1)
 * 같은 결과가 나오도록 오프셋을 길이로 판별한다.
 */
export function registerRowRefs(rawRows: Row[], meta: RowRef[] | undefined): void {
  if (!meta || meta.length === 0) return;
  const offset = meta.length === rawRows.length ? 1 : 0;
  for (let i = 1; i < rawRows.length; i++) {
    const m = meta[i - 1 + offset];
    if (m && typeof m.id === "number" && m.id > 0) REF_BY_ROW.set(rawRows[i], { tab: m.tab, id: m.id });
  }
}

/** 등록된 행 참조. 없으면 undefined (API가 meta를 아직 안 주는 경우) */
export function rowRef(row: Row): RowRef | undefined {
  return REF_BY_ROW.get(row);
}

/**
 * 행 식별 키.
 * ref가 있으면 DB id로 만든다 — 연락처·신청일시가 둘 다 빈 행이 여럿이면
 * 예전 키(신청일시|연락처)가 충돌해 엉뚱한 행이 같이 강조되던 문제가 있었다.
 */
export function rowKey(sheet: SheetKind, row: Row): string {
  const ref = REF_BY_ROW.get(row);
  if (ref) return `${sheet}:${ref.tab}#${ref.id}`;
  const phone = sheet === "booking" ? row[3] : row[2];
  return `${sheet}:${row[0] ?? ""}|${phone ?? ""}`;
}
```

`src/app/admin/_components/BulkPanel.tsx`:
- 52행 주석 → `/** 응답의 행 참조. `{tab,id}`가 계약이지만 문자열로 와도 화면이 깨지지 않게 둘 다 받는다. */`
- `refLabel`의 마지막 줄 → `return `${ref.tab} #${ref.id}`;`
- `whoLabel` 주석 `없으면 시트 행 번호` → `없으면 행 번호(#id)`

`src/app/admin/preview/page.tsx`의 `sampleMeta`:

```ts
/** 실제 API의 meta를 흉내 낸다 — rows와 길이·순서가 같고 meta[0]은 헤더 자리(id 0) */
function sampleMeta(rawRows: Row[], tabOf: (row: Row) => SheetTab): RowRef[] {
  return rawRows.map((row, i) => ({ tab: tabOf(row), id: i }));
}
```

`src/app/admin/page.tsx`:
- 26행 → `/** 6.1 계약 — meta·retreatMeta·openMeta는 rows와 같은 순서의 행 참조({tab, id}) */`
- 162행 → `   * 받은 행에 행 참조(6.1의 meta)를 먼저 붙이고 state에 넣는다.`
- 257행 → `        // ref가 있으면 서버가 DB id로 직접 찾는다 (6.1). 없으면 서버가 예전 방식으로 떨어진다.`

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run src/lib/__tests__/row-ref.test.ts src/lib/__tests__/bulk.test.ts`
Expected: PASS

Run: `npm test 2>&1 | tail -15`
Expected: `bulk-log.test.ts`와 `sheets.test.ts`만 실패하거나 통과(아직 옛 코드). 그 밖의 테스트는 모두 PASS. (`bulk-log`는 Task 7, `sheets`는 Task 8에서 정리)

- [ ] **Step 8: 커밋**

```bash
git add src/lib/row-ref.ts src/lib/bulk.ts src/lib/__tests__/row-ref.test.ts src/lib/__tests__/bulk.test.ts \
  src/app/admin/_components/shared.ts src/app/admin/_components/BulkPanel.tsx src/app/admin/preview/page.tsx src/app/admin/page.tsx
git commit -m "refactor(store): 행 참조를 DB id로, 일괄 처리 쓰기를 패치 목록으로

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: DB 레코드 ↔ 행 변환 (순수)

**Files:**
- Create: `src/lib/store-rows.ts`
- Test: `src/lib/__tests__/store-rows.test.ts`

**Interfaces:**
- Consumes: `parseKstDateTime`, `formatKstDateTime` (Task 1), `BOOKING_HEADER`, `RowMeta`, `RowRef`, `SheetTab`, `BookingPatch` (Task 4), `RETREAT_SESSIONS` (`src/lib/retreat-sessions.ts`)
- Produces (Task 6, 7, 10, 11이 쓴다):
  - 입력 타입 `BookingRow`, `RetreatRow`, `OpenStayRow`, `BookingCheckResult` — `sheets.ts`의 같은 이름 타입을 그대로 옮긴 것
  - 레코드 타입 `BookingKind`, `BookingRecord`, `RetreatRecord`, `OpenStayRecord`
  - `BOOKING_COLUMNS`, `RETREAT_COLUMNS`, `OPEN_STAY_COLUMNS` (select 문자열), `RETREAT_HEADER`, `OPEN_STAY_HEADER`, `KIND_TAB`
  - `bookingToRow(r): string[]`, `retreatToRow(r)`, `openStayToRow(r)`
  - `buildBookingList(records): { rows; meta }` — 헤더 + 살롱 전체 + 스테이 전체, 각 id 오름차순
  - `buildSimpleList(records, toRow, header, tab): { rows; meta }`
  - `bookingInsert(row: BookingRow)`, `retreatInsert(row: RetreatRow)`, `openStayInsert(row: OpenStayRow)` → `id` 없는 레코드
  - `digitsOnly(p: string): string`
  - `pickByCreatedAtThenLatest(candidates, createdAt)` — ① 신청일시 일치 중 최신 ② 최신
  - `bookingCheckResults(records): BookingCheckResult[]`
  - `retreatCounts(sessionLabels: string[]): Record<string, number>`
  - `patchesPayload(patches: BookingPatch[]): { id: number; status?: string; notify?: string }[]` — 예약이 아닌 탭이면 throw

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/store-rows.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  bookingCheckResults,
  bookingInsert,
  bookingToRow,
  buildBookingList,
  buildSimpleList,
  digitsOnly,
  openStayInsert,
  openStayToRow,
  OPEN_STAY_HEADER,
  patchesPayload,
  pickByCreatedAtThenLatest,
  retreatCounts,
  retreatInsert,
  retreatToRow,
  RETREAT_HEADER,
  type BookingRecord,
  type OpenStayRecord,
  type RetreatRecord,
} from "@/lib/store-rows";
import { BOOKING_HEADER } from "@/lib/row-ref";
import { RETREAT_SESSIONS } from "@/lib/retreat-sessions";

// 2026. 9. 6. 오후 7:10:32 (KST)
const CREATED_ISO = "2026-09-06T10:10:32.000Z";
const CREATED_TEXT = "2026. 9. 6. 오후 7:10:32";

function booking(over: Partial<BookingRecord>): BookingRecord {
  return {
    id: 1, kind: "salon", created_at: CREATED_ISO, name: "김살롱", phone: "010-1111-2222",
    program: "프라이데이나잇", date_text: "9월 20일 (일) 19:00", room: "", nights: "",
    check_in: "", check_out: "", discount: "없음", total_amount: 30000, memo: "",
    status: "신청", notify_status: "", ...over,
  };
}

describe("bookingToRow", () => {
  it("시트와 같은 A~O 15열 순서", () => {
    const row = bookingToRow(booking({ memo: "창가 자리", notify_status: "✅ 10:00 접수" }));
    expect(row).toEqual([
      CREATED_TEXT, "살롱", "김살롱", "010-1111-2222", "프라이데이나잇", "9월 20일 (일) 19:00",
      "", "", "", "", "없음", "30000", "창가 자리", "신청", "✅ 10:00 접수",
    ]);
    expect(row).toHaveLength(BOOKING_HEADER.length);
  });

  it("신청일시·금액이 비었으면 빈 문자열 (수기 입력 행)", () => {
    const row = bookingToRow(booking({ kind: "stay", created_at: null, total_amount: null }));
    expect(row[0]).toBe("");
    expect(row[1]).toBe("스테이");
    expect(row[11]).toBe("");
  });
});

describe("buildBookingList", () => {
  it("헤더 + 살롱 전체 + 스테이 전체, 각 탭 안은 id 오름차순 — meta는 길이·순서가 같다", () => {
    const { rows, meta } = buildBookingList([
      booking({ id: 5, kind: "stay", name: "B" }),
      booking({ id: 3, kind: "salon", name: "A2" }),
      booking({ id: 1, kind: "salon", name: "A1" }),
      booking({ id: 4, kind: "stay", name: "B0" }),
    ]);
    expect(rows.map((r) => r[2])).toEqual(["이름", "A1", "A2", "B0", "B"]);
    expect(meta).toEqual([
      { tab: "살롱", id: 0 },
      { tab: "살롱", id: 1 },
      { tab: "살롱", id: 3 },
      { tab: "스테이", id: 4 },
      { tab: "스테이", id: 5 },
    ]);
  });

  it("비어 있으면 헤더 한 줄 + 헤더 자리 meta", () => {
    expect(buildBookingList([])).toEqual({ rows: [BOOKING_HEADER], meta: [{ tab: "살롱", id: 0 }] });
  });

  it("헤더 배열을 복사해서 준다 — 받은 쪽이 고쳐도 공용 상수가 오염되지 않게", () => {
    const { rows } = buildBookingList([]);
    expect(rows[0]).not.toBe(BOOKING_HEADER);
  });
});

describe("리트릿·무료개방 행", () => {
  const retreat: RetreatRecord = {
    id: 7, created_at: CREATED_ISO, name: "이리트", phone: "01033334444", grade: "고2", region: "안동",
    session: "1회차 — 7월 3-5일 (금토일)", referral: "", question: "?", memo: "m", allergy: "땅콩",
    care: "", parent_note: "p", status: "신청",
  };
  const open: OpenStayRecord = {
    id: 9, created_at: null, name: "박개방", phone: "010", email: "a@b.c", check_in: "2026-09-20",
    check_out: "2026-09-21", group_type: "혼자", group_size: "1", reason: "r", contribution: "청소",
    message: "", status: "확정",
  };

  it("리트릿은 A~M 13열", () => {
    const row = retreatToRow(retreat);
    expect(row).toHaveLength(RETREAT_HEADER.length);
    expect(row[0]).toBe(CREATED_TEXT);
    expect(row[5]).toBe("1회차 — 7월 3-5일 (금토일)");
    expect(row[12]).toBe("신청");
  });

  it("무료개방은 A~L 12열", () => {
    const row = openStayToRow(open);
    expect(row).toHaveLength(OPEN_STAY_HEADER.length);
    expect(row[0]).toBe("");
    expect(row[11]).toBe("확정");
  });

  it("buildSimpleList는 헤더 + id 오름차순, meta 헤더 자리는 id 0", () => {
    const { rows, meta } = buildSimpleList([{ ...retreat, id: 8 }, retreat], retreatToRow, RETREAT_HEADER, "리트릿");
    expect(rows).toHaveLength(3);
    expect(meta).toEqual([{ tab: "리트릿", id: 0 }, { tab: "리트릿", id: 7 }, { tab: "리트릿", id: 8 }]);
  });
});

describe("입력 → 레코드", () => {
  it("예약: 신청일시는 실제 시각, 할인 코드는 표시 문자열, 금액은 정수", () => {
    expect(
      bookingInsert({
        type: "stay", createdAt: CREATED_TEXT, name: "홍", phone: "010-1", room: "옥순방",
        nights: "2", checkIn: "2026-09-20", checkOut: "2026-09-22", discount: "geot",
        totalAmount: 240000, status: "신청",
      })
    ).toEqual({
      kind: "stay", created_at: CREATED_ISO, name: "홍", phone: "010-1", program: "", date_text: "",
      room: "옥순방", nights: "2", check_in: "2026-09-20", check_out: "2026-09-22",
      discount: "멤버십 곁 (-20%)", total_amount: 240000, memo: "", status: "신청", notify_status: "",
    });
  });

  it("할인 코드: nagnae → 나그네방 후원자, 그 밖에는 없음", () => {
    const base = { type: "salon", createdAt: "", name: "", phone: "", totalAmount: 0, status: "신청" };
    expect(bookingInsert({ ...base, discount: "nagnae" }).discount).toBe("나그네방 후원자 (-30%)");
    expect(bookingInsert({ ...base, discount: "none" }).discount).toBe("없음");
  });

  it("금액이 숫자가 아니면 null, 신청일시 형식이 다르면 null", () => {
    const r = bookingInsert({
      type: "salon", createdAt: "어제", name: "", phone: "", discount: "none",
      totalAmount: undefined as unknown as number, status: "신청",
    });
    expect(r.total_amount).toBeNull();
    expect(r.created_at).toBeNull();
    expect(r.kind).toBe("salon");
  });

  it("리트릿: 회차 키를 라벨로 바꿔 저장 (시트와 같다)", () => {
    const r = retreatInsert({
      createdAt: CREATED_TEXT, name: "a", phone: "b", grade: "c", region: "d", session: "s1",
      referral: "", question: "", memo: "", allergy: "", care: "", parentNote: "pn", status: "신청",
    });
    expect(r.session).toBe(RETREAT_SESSIONS.find((s) => s.key === "s1")!.label);
    expect(r.parent_note).toBe("pn");
    expect(r.created_at).toBe(CREATED_ISO);
  });

  it("무료개방: 필드 이름만 바꿔 그대로", () => {
    const r = openStayInsert({
      createdAt: CREATED_TEXT, name: "a", phone: "b", email: "e", checkIn: "i", checkOut: "o",
      groupType: "팀/모임", groupSize: "4", reason: "r", contribution: "청소, 요리", message: "m", status: "신청",
    });
    expect(r).toEqual({
      created_at: CREATED_ISO, name: "a", phone: "b", email: "e", check_in: "i", check_out: "o",
      group_type: "팀/모임", group_size: "4", reason: "r", contribution: "청소, 요리", message: "m", status: "신청",
    });
  });
});

describe("행 찾기 규칙 (ref 없을 때)", () => {
  const a = booking({ id: 1, created_at: CREATED_ISO });
  const b = booking({ id: 2, created_at: "2026-09-07T01:00:00.000Z" });

  it("신청일시가 같은 행이 있으면 그 행", () => {
    expect(pickByCreatedAtThenLatest([a, b], CREATED_TEXT)?.id).toBe(1);
  });

  it("없으면 가장 최근(id 큰) 행", () => {
    expect(pickByCreatedAtThenLatest([a, b], "2020. 1. 1. 오전 1:00:00")?.id).toBe(2);
  });

  it("후보가 없으면 null", () => {
    expect(pickByCreatedAtThenLatest([], CREATED_TEXT)).toBeNull();
  });

  it("digitsOnly는 숫자만", () => {
    expect(digitsOnly("010-1234 5678")).toBe("01012345678");
    expect(digitsOnly(undefined as unknown as string)).toBe("");
  });
});

describe("bookingCheckResults (예약 확인 페이지)", () => {
  it("최신순, 살롱은 프로그램·일시, 스테이는 객실·기간", () => {
    const res = bookingCheckResults([
      booking({ id: 1 }),
      booking({ id: 2, kind: "stay", room: "옥순방", check_in: "2026-09-20", check_out: "2026-09-22", nights: "2", status: "" }),
    ]);
    expect(res.map((r) => r.type)).toEqual(["스테이", "살롱"]);
    expect(res[0]).toMatchObject({ program: "옥순방", date: "2026-09-20 ~ 2026-09-22 (2박)", status: "신청" });
    expect(res[1]).toMatchObject({ program: "프라이데이나잇", date: "9월 20일 (일) 19:00", amount: "30000", createdAt: CREATED_TEXT });
  });

  it("신청일시가 없는 수기 입력 행은 빼준다 (시트 시절과 같다)", () => {
    expect(bookingCheckResults([booking({ created_at: null })])).toEqual([]);
  });
});

describe("retreatCounts", () => {
  it("라벨을 회차 키로 세고, 모르는 라벨은 무시, 없는 회차는 0", () => {
    const [s1, s2] = RETREAT_SESSIONS;
    const counts = retreatCounts([s1.label, s1.label, s2.label, "옛 회차"]);
    expect(counts[s1.key]).toBe(2);
    expect(counts[s2.key]).toBe(1);
    expect(Object.keys(counts).sort()).toEqual(RETREAT_SESSIONS.map((s) => s.key).sort());
  });
});

describe("patchesPayload", () => {
  it("DB 함수에 넘길 모양 — 없는 키는 빼고, 빈 문자열은 그대로", () => {
    expect(
      patchesPayload([
        { ref: { tab: "살롱", id: 3 }, status: "입금확인" },
        { ref: { tab: "스테이", id: 4 }, status: "", notify: "" },
      ])
    ).toEqual([{ id: 3, status: "입금확인" }, { id: 4, status: "", notify: "" }]);
  });

  it("예약이 아닌 탭이 섞이면 거부 — 다른 테이블 id를 예약 id로 오해하지 않게", () => {
    expect(() => patchesPayload([{ ref: { tab: "리트릿", id: 3 }, status: "확정" }])).toThrow(/리트릿/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/store-rows.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/store-rows"`

- [ ] **Step 3: 구현**

`src/lib/store-rows.ts`:

```ts
/**
 * DB 레코드 ↔ 화면·로직이 쓰는 행(`string[]`) 변환 — 순수 로직.
 *
 * 2026-09-19 구글 시트 → Supabase 이전. 행 모양(열 순서)은 시트와 똑같이 유지한다 —
 * digest·stats·list-filter·bulk·관리자 화면이 `row[13]` 같은 인덱스로 읽기 때문이다.
 * DB 쿼리는 `store.ts`, 변환·매칭 규칙은 여기.
 */

import { formatKstDateTime, parseKstDateTime } from "@/lib/kst-datetime";
import { RETREAT_SESSIONS } from "@/lib/retreat-sessions";
import {
  BOOKING_HEADER,
  isBookingTab,
  type BookingPatch,
  type RowMeta,
  type SheetTab,
} from "@/lib/row-ref";

/* ─── 입력 타입 (라우트가 넘기는 값 — 시트 시절 그대로) ───── */

export type BookingRow = {
  type: string;         // salon | stay
  createdAt: string;    // "2026. 9. 6. 오후 7:10:32"
  name: string;
  phone: string;
  program?: string;     // 살롱 프로그램명
  date?: string;        // 날짜/일시
  room?: string;        // 스테이 객실명
  nights?: string;      // 박수
  checkIn?: string;
  checkOut?: string;
  discount: string;
  totalAmount: number;
  memo?: string;
  status: string;       // 신청 | 입금확인 | 취소
  notifyStatus?: string; // 게스트 알림 발송 결과 (✅ HH:MM / ❌ 실패)
};

export type RetreatRow = {
  createdAt: string;
  name: string;
  phone: string;
  grade: string;      // 학년/나이
  region: string;     // 거주 지역
  session: string;    // s1~s5
  referral: string;   // 추천인
  question: string;   // 궁금한 점
  memo: string;       // 요청사항
  allergy: string;    // 음식 알레르기
  care: string;       // 특별 케어 사항
  parentNote: string; // 부모님 고민·기대감
  status: string;     // 신청
};

export type OpenStayRow = {
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  groupType: string;  // 혼자 | 둘이 | 가족 | 팀/모임
  groupSize: string;
  reason: string;
  contribution: string; // 쉼표 구분 복수 선택
  message: string;
  status: string; // 신청 | 확정 | 취소
};

export type BookingCheckResult = {
  type: "살롱" | "스테이";
  createdAt: string;
  name: string;
  program: string;    // 살롱: 프로그램명, 스테이: 객실명
  date: string;       // 살롱: 일시, 스테이: 체크인~체크아웃
  amount: string;
  status: string;
};

/* ─── DB 레코드 ─────────────────────────────────── */

export type BookingKind = "salon" | "stay";

export type BookingRecord = {
  id: number;
  kind: BookingKind;
  created_at: string | null;
  name: string;
  phone: string;
  program: string;
  date_text: string;
  room: string;
  nights: string;
  check_in: string;
  check_out: string;
  discount: string;
  total_amount: number | null;
  memo: string;
  status: string;
  notify_status: string;
};

export type RetreatRecord = {
  id: number;
  created_at: string | null;
  name: string;
  phone: string;
  grade: string;
  region: string;
  session: string;
  referral: string;
  question: string;
  memo: string;
  allergy: string;
  care: string;
  parent_note: string;
  status: string;
};

export type OpenStayRecord = {
  id: number;
  created_at: string | null;
  name: string;
  phone: string;
  email: string;
  check_in: string;
  check_out: string;
  group_type: string;
  group_size: string;
  reason: string;
  contribution: string;
  message: string;
  status: string;
};

export const BOOKING_COLUMNS =
  "id,kind,created_at,name,phone,program,date_text,room,nights,check_in,check_out,discount,total_amount,memo,status,notify_status";
export const RETREAT_COLUMNS =
  "id,created_at,name,phone,grade,region,session,referral,question,memo,allergy,care,parent_note,status";
export const OPEN_STAY_COLUMNS =
  "id,created_at,name,phone,email,check_in,check_out,group_type,group_size,reason,contribution,message,status";

export const RETREAT_HEADER = [
  "신청일시","이름","연락처","학년나이","거주지역","회차","추천인","궁금한점","요청사항","알레르기","케어사항","부모님메모","상태",
];
export const OPEN_STAY_HEADER = [
  "신청일시","이름","연락처","이메일","체크인","체크아웃","방문형태","인원","방문이유","기여방법","응원메시지","상태",
];

export const KIND_TAB: Record<BookingKind, "살롱" | "스테이"> = { salon: "살롱", stay: "스테이" };

/* ─── 레코드 → 행 ───────────────────────────────── */

function createdText(iso: string | null): string {
  return iso ? formatKstDateTime(new Date(iso)) : "";
}

/** 예약 A~O: 신청일시 구분 이름 연락처 프로그램 일시 객실 박수 체크인 체크아웃 할인 결제금액 요청사항 상태 알림 */
export function bookingToRow(r: BookingRecord): string[] {
  return [
    createdText(r.created_at), KIND_TAB[r.kind], r.name, r.phone, r.program, r.date_text,
    r.room, r.nights, r.check_in, r.check_out, r.discount,
    r.total_amount == null ? "" : String(r.total_amount),
    r.memo, r.status, r.notify_status,
  ];
}

/** 리트릿 A~M */
export function retreatToRow(r: RetreatRecord): string[] {
  return [
    createdText(r.created_at), r.name, r.phone, r.grade, r.region, r.session, r.referral,
    r.question, r.memo, r.allergy, r.care, r.parent_note, r.status,
  ];
}

/** 무료개방 A~L */
export function openStayToRow(r: OpenStayRecord): string[] {
  return [
    createdText(r.created_at), r.name, r.phone, r.email, r.check_in, r.check_out,
    r.group_type, r.group_size, r.reason, r.contribution, r.message, r.status,
  ];
}

const byIdAsc = <T extends { id: number }>(a: T, b: T) => a.id - b.id;

/**
 * 살롱 + 스테이 목록. 시트 시절 `mergeBookingRowsWithMeta`와 같은 순서:
 * 헤더 1줄 + 살롱 전체 + 스테이 전체(각각 추가된 순서 = id 오름차순).
 * meta는 rows와 **길이·순서가 같다**(meta[0]은 헤더 자리, id 0).
 */
export function buildBookingList(records: BookingRecord[]): { rows: string[][]; meta: RowMeta[] } {
  const sorted = [...records].sort(byIdAsc);
  const rows: string[][] = [[...BOOKING_HEADER]];
  const meta: RowMeta[] = [{ tab: "살롱", id: 0 }];
  for (const kind of ["salon", "stay"] as const) {
    for (const r of sorted) {
      if (r.kind !== kind) continue;
      rows.push(bookingToRow(r));
      meta.push({ tab: KIND_TAB[kind], id: r.id });
    }
  }
  return { rows, meta };
}

/** 리트릿·무료개방 목록 — 헤더 1줄 + id 오름차순. meta 규칙은 buildBookingList와 같다. */
export function buildSimpleList<T extends { id: number }>(
  records: T[],
  toRow: (r: T) => string[],
  header: string[],
  tab: SheetTab
): { rows: string[][]; meta: RowMeta[] } {
  const rows: string[][] = [[...header]];
  const meta: RowMeta[] = [{ tab, id: 0 }];
  for (const r of [...records].sort(byIdAsc)) {
    rows.push(toRow(r));
    meta.push({ tab, id: r.id });
  }
  return { rows, meta };
}

/* ─── 입력 → 레코드 ─────────────────────────────── */

function createdIso(s: string): string | null {
  const d = parseKstDateTime(s);
  return d ? d.toISOString() : null;
}

function discountLabel(code: string): string {
  if (code === "geot") return "멤버십 곁 (-20%)";
  if (code === "nagnae") return "나그네방 후원자 (-30%)";
  return "없음";
}

function amountOrNull(v: unknown): number | null {
  const n = Number(v);
  return v !== undefined && v !== null && v !== "" && Number.isFinite(n) ? Math.round(n) : null;
}

export function bookingInsert(row: BookingRow): Omit<BookingRecord, "id"> {
  return {
    kind: row.type === "salon" ? "salon" : "stay",
    created_at: createdIso(row.createdAt),
    name: row.name ?? "",
    phone: row.phone ?? "",
    program: row.program ?? "",
    date_text: row.date ?? "",
    room: row.room ?? "",
    nights: row.nights ?? "",
    check_in: row.checkIn ?? "",
    check_out: row.checkOut ?? "",
    discount: discountLabel(row.discount),
    total_amount: amountOrNull(row.totalAmount),
    memo: row.memo ?? "",
    status: row.status,
    notify_status: row.notifyStatus ?? "",
  };
}

export function retreatInsert(row: RetreatRow): Omit<RetreatRecord, "id"> {
  return {
    created_at: createdIso(row.createdAt),
    name: row.name,
    phone: row.phone,
    grade: row.grade,
    region: row.region,
    session: RETREAT_SESSIONS.find((s) => s.key === row.session)?.label ?? row.session,
    referral: row.referral,
    question: row.question,
    memo: row.memo,
    allergy: row.allergy,
    care: row.care,
    parent_note: row.parentNote,
    status: row.status,
  };
}

export function openStayInsert(row: OpenStayRow): Omit<OpenStayRecord, "id"> {
  return {
    created_at: createdIso(row.createdAt),
    name: row.name,
    phone: row.phone,
    email: row.email,
    check_in: row.checkIn,
    check_out: row.checkOut,
    group_type: row.groupType,
    group_size: row.groupSize,
    reason: row.reason,
    contribution: row.contribution,
    message: row.message,
    status: row.status,
  };
}

/* ─── 행 찾기 (ref가 없을 때의 옛 경로) ─────────── */

export function digitsOnly(p: string): string {
  return (p ?? "").replace(/\D/g, "");
}

/**
 * 시트 시절과 같은 순서: ① 신청일시(표시 문자열)가 같은 행 중 최신 ② 그냥 최신.
 * candidates는 이미 연락처 숫자로 좁힌 행이다. 최신 = id가 큰 행.
 */
export function pickByCreatedAtThenLatest<T extends { id: number; created_at: string | null }>(
  candidates: T[],
  createdAt: string
): T | null {
  const desc = [...candidates].sort((a, b) => b.id - a.id);
  return desc.find((r) => createdText(r.created_at) === createdAt) ?? desc[0] ?? null;
}

/* ─── 예약 확인 페이지 · 리트릿 인원 ────────────── */

/** 최신순. 신청일시가 없는 수기 입력 행은 시트 시절처럼 빼준다. */
export function bookingCheckResults(records: BookingRecord[]): BookingCheckResult[] {
  return [...records]
    .filter((r) => r.created_at)
    .sort((a, b) => b.id - a.id)
    .map((r) => {
      const row = bookingToRow(r);
      const type = KIND_TAB[r.kind];
      return {
        type,
        createdAt: row[0],
        name: r.name,
        program: type === "살롱" ? r.program : r.room,
        date: type === "살롱" ? r.date_text : `${r.check_in} ~ ${r.check_out} (${r.nights}박)`,
        amount: row[11],
        status: r.status || "신청",
      };
    });
}

/** 회차 라벨 목록 → { s1: 3, s2: 0, ... } (회차 정의는 RETREAT_SESSIONS 하나만 본다) */
export function retreatCounts(sessionLabels: string[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(RETREAT_SESSIONS.map((s) => [s.key, 0]));
  const keyOf: Record<string, string> = Object.fromEntries(RETREAT_SESSIONS.map((s) => [s.label, s.key]));
  for (const label of sessionLabels) {
    const key = keyOf[label];
    if (key) counts[key] += 1;
  }
  return counts;
}

/* ─── 일괄 처리 ─────────────────────────────────── */

/** `apply_booking_patches`에 넘길 모양. 키가 없는 칸은 빼서 DB가 그대로 두게 한다. */
export function patchesPayload(
  patches: BookingPatch[]
): { id: number; status?: string; notify?: string }[] {
  return patches.map((p) => {
    if (!isBookingTab(p.ref.tab)) {
      throw new Error(`예약이 아닌 행은 일괄 처리할 수 없습니다: ${p.ref.tab} #${p.ref.id}`);
    }
    return {
      id: p.ref.id,
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.notify !== undefined ? { notify: p.notify } : {}),
    };
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/store-rows.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/store-rows.ts src/lib/__tests__/store-rows.test.ts
git commit -m "feat(store): DB 레코드 ↔ 시트 모양 행 변환(순수)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Supabase 쿼리 계층 (`store.ts`)

**Files:**
- Create: `src/lib/store.ts`
- Create: `src/lib/__tests__/fake-db.ts` (테스트 도우미 — `.test.ts`가 아니라 테스트로 실행되지 않는다)
- Test: `src/lib/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `getDb` (Task 3), `fetchAllPages`/`PageResult` (Task 2), Task 5의 전부, `isBookingTab`/`BookingPatch`/`RowRef` (Task 4)
- Produces (`sheets.ts`와 같은 이름·시그니처. 반환만 바뀐 것은 굵게):
  - `appendBooking(row: BookingRow): Promise<RowRef | null>` **(void → ref)**
  - `appendRetreat(row: RetreatRow): Promise<RowRef | null>` **(void → ref)**
  - `appendOpenStay(row: OpenStayRow): Promise<RowRef | null>` **(void → ref)**
  - `getAllBookings(): Promise<string[][]>`, `getAllBookingsWithMeta(): Promise<{ rows: string[][]; meta: RowMeta[] }>`
  - `getAllRetreats()`, `getAllRetreatsWithMeta()`, `getAllOpenStays()`, `getAllOpenStaysWithMeta()` — 같은 모양
  - `getRetreatCounts(): Promise<Record<string, number>>` — 오류 시 0으로 채운 값
  - `getBookingsByPhone(phone: string): Promise<BookingCheckResult[]>`
  - `getBookingRow(type, createdAt, phone, ref?): Promise<string[] | null>`
  - `updateBookingStatus(type, createdAt, phone, status, ref?): Promise<boolean>`
  - `updateNotifyStatus(type, createdAt, phone, status, ref?): Promise<boolean>`
  - `appendBookingMemo(type, createdAt, phone, text, ref?): Promise<boolean>`
  - `updateRetreatStatus(createdAt, phone, status, ref?): Promise<boolean>`
  - `updateOpenStayStatus(createdAt, phone, status, ref?): Promise<boolean>`
  - `applyPatches(patches: BookingPatch[]): Promise<number>` — 갱신된 행 수
  - 타입 re-export: `BookingRow`, `RetreatRow`, `OpenStayRow`, `BookingCheckResult`, `RowMeta`, `RowRef`, `SheetTab`

- [ ] **Step 1: 가짜 DB 도우미 작성**

`src/lib/__tests__/fake-db.ts`:

```ts
/**
 * store.ts 테스트용 가짜 Supabase 클라이언트.
 * 실제 API처럼 한 번에 최대 maxRows(기본 1,000)행만 돌려준다 — 페이지 반복이 빠지면 테스트가 잡는다.
 * 지원: from().select().eq().not(is null).order().range().limit().maybeSingle().single(),
 *       insert().select().single(), update().eq().select(), rpc()
 */

type Row = Record<string, unknown> & { id: number };
type Result = { data: unknown; error: unknown };

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export class FakeDb {
  tables: Record<string, Row[]> = {};
  rpcCalls: { fn: string; args: unknown }[] = [];
  rpcResult: Result = { data: 0, error: null };
  /** 설정하면 이후 모든 쿼리가 이 오류로 실패한다 */
  failWith: unknown = null;
  maxRows = 1000;
  private nextId = 1;

  seed(table: string, rows: Record<string, unknown>[]): void {
    const t = (this.tables[table] ??= []);
    for (const r of rows) {
      const id = typeof r.id === "number" ? r.id : this.nextId++;
      this.nextId = Math.max(this.nextId, id + 1);
      t.push({ ...r, id, phone_digits: digits(r.phone) });
    }
  }

  insertRow(table: string, values: Record<string, unknown>): Row {
    const row = { ...values, id: this.nextId++, phone_digits: digits(values.phone) } as Row;
    (this.tables[table] ??= []).push(row);
    return row;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc(fn: string, args: unknown): Promise<Result> {
    if (this.failWith) return { data: null, error: this.failWith };
    this.rpcCalls.push({ fn, args });
    return this.rpcResult;
  }
}

class FakeQuery implements PromiseLike<Result> {
  private mode: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> = {};
  private filters: ((r: Row) => boolean)[] = [];
  private asc = true;
  private rangeArgs: [number, number] | null = null;
  private limitN: number | null = null;
  private singleMode: "one" | "maybe" | null = null;

  constructor(private db: FakeDb, private table: string) {}

  select(_columns?: string) { return this; }
  insert(values: Record<string, unknown>) { this.mode = "insert"; this.payload = values; return this; }
  update(values: Record<string, unknown>) { this.mode = "update"; this.payload = values; return this; }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  not(col: string, op: string, val: unknown) {
    if (op === "is" && val === null) this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    return this;
  }
  order(_col: string, opts?: { ascending?: boolean }) { this.asc = opts?.ascending !== false; return this; }
  range(from: number, to: number) { this.rangeArgs = [from, to]; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.singleMode = "one"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }

  then<A = Result, B = never>(
    onFulfilled?: ((v: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((e: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }

  private run(): Result {
    if (this.db.failWith) return { data: null, error: this.db.failWith };

    if (this.mode === "insert") {
      const row = this.db.insertRow(this.table, this.payload);
      return { data: this.singleMode ? row : [row], error: null };
    }

    const rows = (this.db.tables[this.table] ??= []);
    let hit = rows.filter((r) => this.filters.every((f) => f(r)));
    hit.sort((a, b) => (this.asc ? a.id - b.id : b.id - a.id));

    if (this.mode === "update") {
      for (const r of hit) Object.assign(r, this.payload);
      return { data: hit.map((r) => ({ id: r.id })), error: null };
    }

    if (this.rangeArgs) {
      const [from, to] = this.rangeArgs;
      hit = hit.slice(from, Math.min(to + 1, from + this.db.maxRows));
    } else {
      hit = hit.slice(0, this.db.maxRows);
    }
    if (this.limitN !== null) hit = hit.slice(0, this.limitN);

    if (this.singleMode) return { data: hit[0] ?? null, error: null };
    return { data: hit.map((r) => ({ ...r })), error: null };
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/__tests__/store.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FakeDb } from "./fake-db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase", () => ({ getDb: () => state.db }));

import {
  appendBooking,
  appendBookingMemo,
  appendOpenStay,
  appendRetreat,
  applyPatches,
  getAllBookingsWithMeta,
  getAllRetreatsWithMeta,
  getBookingRow,
  getBookingsByPhone,
  getRetreatCounts,
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

describe("신청 저장", () => {
  it("새 행의 ref를 돌려주고, 신청일시는 실제 시각으로 저장한다", async () => {
    const ref = await appendBooking({
      type: "salon", createdAt: CREATED_TEXT, name: "홍", phone: "010-9", discount: "none",
      totalAmount: 30000, status: "신청",
    });
    expect(ref).toEqual({ tab: "살롱", id: 1 });
    expect(db.tables.bookings[0].created_at).toBe(CREATED_ISO);
  });

  it("리트릿·무료개방도 ref를 돌려준다", async () => {
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
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/__tests__/store.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/store"`

- [ ] **Step 4: 구현**

`src/lib/store.ts`:

```ts
/**
 * 예약 데이터 저장소 — Supabase 쿼리 계층 (2026-09-19 `sheets.ts` 대체).
 *
 * 함수 이름·반환 모양은 시트 시절 그대로다: 목록은 헤더 1줄을 포함한 `string[][]` +
 * 같은 길이의 meta. 변환·매칭 규칙은 순수 모듈 `store-rows.ts`에 있고, 여기는 쿼리만 한다.
 *
 * - 전체 읽기는 반드시 `fetchAllPages`로 (Supabase는 1,000행에서 조용히 자른다).
 * - DB 오류는 "행 없음"으로 위장하지 않고 던진다(2026-09-10 429 → 404 오인 사례).
 *   예외: `getRetreatCounts`는 신청 페이지가 죽지 않게 0으로 채워 돌려준다.
 */

import { getDb } from "@/lib/supabase";
import { fetchAllPages, type PageResult } from "@/lib/paginate";
import { isBookingTab, type BookingPatch, type RowMeta, type RowRef } from "@/lib/row-ref";
import {
  BOOKING_COLUMNS,
  bookingCheckResults,
  bookingInsert,
  bookingToRow,
  buildBookingList,
  buildSimpleList,
  digitsOnly,
  KIND_TAB,
  OPEN_STAY_COLUMNS,
  OPEN_STAY_HEADER,
  openStayInsert,
  openStayToRow,
  patchesPayload,
  pickByCreatedAtThenLatest,
  RETREAT_COLUMNS,
  RETREAT_HEADER,
  retreatCounts,
  retreatInsert,
  retreatToRow,
  type BookingCheckResult,
  type BookingKind,
  type BookingRecord,
  type BookingRow,
  type OpenStayRecord,
  type OpenStayRow,
  type RetreatRecord,
  type RetreatRow,
} from "@/lib/store-rows";

export type { BookingCheckResult, BookingRow, OpenStayRow, RetreatRow } from "@/lib/store-rows";
export type { RowMeta, RowRef, SheetTab } from "@/lib/row-ref";

type Table = "bookings" | "retreats" | "open_stays";
type List = { rows: string[][]; meta: RowMeta[] };

/** 테이블 전체(또는 연락처 숫자로 좁힌 전체)를 id 순으로 끝까지 읽는다. */
function allRows<T>(table: Table, columns: string, phoneDigits?: string): Promise<T[]> {
  const db = getDb()!;
  return fetchAllPages<T>((from, to) => {
    const base = db.from(table).select(columns);
    const filtered = phoneDigits === undefined ? base : base.eq("phone_digits", phoneDigits);
    return filtered.order("id", { ascending: true }).range(from, to) as unknown as PromiseLike<PageResult<T>>;
  });
}

async function byId<T>(table: Table, columns: string, id: number): Promise<T | null> {
  const { data, error } = await getDb()!.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as T | null) ?? null;
}

async function updateById(table: Table, id: number, values: Record<string, string>): Promise<boolean> {
  const { data, error } = await getDb()!.from(table).update(values).eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

async function insertOne(table: Table, values: object): Promise<{ id: number; kind?: BookingKind }> {
  const { data, error } = await getDb()!.from(table).insert(values).select("id,kind").single();
  if (error) throw error;
  return data as { id: number; kind?: BookingKind };
}

/* ─── 쓰기 ─────────────────────────────────────── */

/** 예약 저장. 새 행의 ref를 돌려준다 — 알림 결과를 바로 이 행에 기록하려고. */
export async function appendBooking(row: BookingRow): Promise<RowRef | null> {
  if (!getDb()) {
    console.warn("[DB] 환경변수 미설정 — 예약 저장 건너뜀");
    return null;
  }
  const saved = await insertOne("bookings", bookingInsert(row));
  return { tab: KIND_TAB[saved.kind ?? "stay"], id: saved.id };
}

export async function appendRetreat(row: RetreatRow): Promise<RowRef | null> {
  if (!getDb()) {
    console.warn("[DB] 환경변수 미설정 — 리트릿 저장 건너뜀");
    return null;
  }
  const saved = await insertOne("retreats", retreatInsert(row));
  return { tab: "리트릿", id: saved.id };
}

export async function appendOpenStay(row: OpenStayRow): Promise<RowRef | null> {
  if (!getDb()) {
    console.warn("[DB] 환경변수 미설정 — 무료개방 저장 건너뜀");
    return null;
  }
  const saved = await insertOne("open_stays", openStayInsert(row));
  return { tab: "무료개방", id: saved.id };
}

/* ─── 목록 ─────────────────────────────────────── */

/** 살롱 + 스테이 (어드민/cron용). 헤더는 첫 행 한 번만 포함 */
export async function getAllBookings(): Promise<string[][]> {
  return (await getAllBookingsWithMeta()).rows;
}

/** getAllBookings + 각 행의 ref. meta는 rows와 **길이·순서가 같다** (meta[0]은 헤더 자리). */
export async function getAllBookingsWithMeta(): Promise<List> {
  if (!getDb()) return { rows: [], meta: [] };
  return buildBookingList(await allRows<BookingRecord>("bookings", BOOKING_COLUMNS));
}

export async function getAllRetreats(): Promise<string[][]> {
  return (await getAllRetreatsWithMeta()).rows;
}

export async function getAllRetreatsWithMeta(): Promise<List> {
  if (!getDb()) return { rows: [], meta: [] };
  const recs = await allRows<RetreatRecord>("retreats", RETREAT_COLUMNS);
  return buildSimpleList(recs, retreatToRow, RETREAT_HEADER, "리트릿");
}

export async function getAllOpenStays(): Promise<string[][]> {
  return (await getAllOpenStaysWithMeta()).rows;
}

export async function getAllOpenStaysWithMeta(): Promise<List> {
  if (!getDb()) return { rows: [], meta: [] };
  const recs = await allRows<OpenStayRecord>("open_stays", OPEN_STAY_COLUMNS);
  return buildSimpleList(recs, openStayToRow, OPEN_STAY_HEADER, "무료개방");
}

/** 회차별 신청 인원 { s1: 3, s2: 0, ... }. 오류 시 전부 0 (신청 페이지가 죽지 않게). */
export async function getRetreatCounts(): Promise<Record<string, number>> {
  if (!getDb()) return retreatCounts([]);
  try {
    const recs = await allRows<{ id: number; session: string }>("retreats", "id,session");
    return retreatCounts(recs.map((r) => r.session));
  } catch (e) {
    console.error("[DB] 리트릿 인원 집계 실패", e);
    return retreatCounts([]);
  }
}

/** 예약 확인 페이지 — 연락처(숫자만 비교)로 찾은 살롱·스테이, 최신순 */
export async function getBookingsByPhone(phone: string): Promise<BookingCheckResult[]> {
  const target = digitsOnly(phone);
  if (!target || !getDb()) return [];
  return bookingCheckResults(await allRows<BookingRecord>("bookings", BOOKING_COLUMNS, target));
}

/* ─── 예약 한 건 찾기·갱신 ─────────────────────── */

/**
 * ref가 예약 탭을 가리키면 id로 바로. 없거나 그 행이 없으면 옛 경로:
 * 연락처 숫자로 좁힌 뒤 ① 신청일시 일치 ② 최신. 연락처가 비면 찾지 않는다.
 */
async function findBooking(
  type: string,
  createdAt: string,
  phone: string,
  ref?: RowRef
): Promise<BookingRecord | null> {
  if (!getDb()) return null;
  if (ref && isBookingTab(ref.tab)) {
    const hit = await byId<BookingRecord>("bookings", BOOKING_COLUMNS, ref.id);
    if (hit) return hit;
  }
  const target = digitsOnly(phone);
  if (!target) return null;
  const kind: BookingKind = type === "salon" || type === "살롱" ? "salon" : "stay";
  const candidates = (await allRows<BookingRecord>("bookings", BOOKING_COLUMNS, target)).filter(
    (r) => r.kind === kind
  );
  return pickByCreatedAtThenLatest(candidates, createdAt);
}

/** 예약 행(A~O)을 그대로 반환. 현재 상태 확인용. */
export async function getBookingRow(
  type: string,
  createdAt: string,
  phone: string,
  ref?: RowRef
): Promise<string[] | null> {
  const rec = await findBooking(type, createdAt, phone, ref);
  return rec ? bookingToRow(rec) : null;
}

/** 알림 발송 결과를 '알림' 칸에 기록 */
export async function updateNotifyStatus(
  type: string,
  createdAt: string,
  phone: string,
  status: string,
  ref?: RowRef
): Promise<boolean> {
  const rec = await findBooking(type, createdAt, phone, ref);
  return rec ? updateById("bookings", rec.id, { notify_status: status }) : false;
}

/** '상태' 칸 갱신 */
export async function updateBookingStatus(
  type: string,
  createdAt: string,
  phone: string,
  status: string,
  ref?: RowRef
): Promise<boolean> {
  const rec = await findBooking(type, createdAt, phone, ref);
  return rec ? updateById("bookings", rec.id, { status }) : false;
}

/** '요청사항'에 한 줄 덧붙인다 (취소 사유 등). 기존 내용은 지우지 않는다. */
export async function appendBookingMemo(
  type: string,
  createdAt: string,
  phone: string,
  text: string,
  ref?: RowRef
): Promise<boolean> {
  if (!text) return false;
  const rec = await findBooking(type, createdAt, phone, ref);
  if (!rec) return false;
  const prev = (rec.memo ?? "").trim();
  return updateById("bookings", rec.id, { memo: prev ? `${prev}\n${text}` : text });
}

/* ─── 리트릿·무료개방 상태 ─────────────────────── */

async function findSimple<T extends { id: number; created_at: string | null }>(
  table: "retreats" | "open_stays",
  columns: string,
  tab: "리트릿" | "무료개방",
  createdAt: string,
  phone: string,
  ref?: RowRef
): Promise<T | null> {
  if (!getDb()) return null;
  if (ref?.tab === tab) {
    const hit = await byId<T>(table, columns, ref.id);
    if (hit) return hit;
  }
  const target = digitsOnly(phone);
  if (!target) return null;
  return pickByCreatedAtThenLatest(await allRows<T>(table, columns, target), createdAt);
}

export async function updateRetreatStatus(
  createdAt: string,
  phone: string,
  status: string,
  ref?: RowRef
): Promise<boolean> {
  const rec = await findSimple<RetreatRecord>("retreats", RETREAT_COLUMNS, "리트릿", createdAt, phone, ref);
  return rec ? updateById("retreats", rec.id, { status }) : false;
}

export async function updateOpenStayStatus(
  createdAt: string,
  phone: string,
  status: string,
  ref?: RowRef
): Promise<boolean> {
  const rec = await findSimple<OpenStayRecord>("open_stays", OPEN_STAY_COLUMNS, "무료개방", createdAt, phone, ref);
  return rec ? updateById("open_stays", rec.id, { status }) : false;
}

/* ─── 일괄 처리 ─────────────────────────────────── */

/**
 * 예약 여러 건의 상태·알림 칸을 **한 트랜잭션**으로 바꾼다(DB 함수 `apply_booking_patches`).
 * 없는 id가 하나라도 있으면 전체가 롤백되고 오류를 던진다. 반환: 갱신된 행 수.
 */
export async function applyPatches(patches: BookingPatch[]): Promise<number> {
  if (patches.length === 0) return 0;
  const db = getDb();
  if (!db) return 0;
  const { data, error } = await db.rpc("apply_booking_patches", { patches: patchesPayload(patches) });
  if (error) throw error;
  return Number(data ?? 0);
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/__tests__/store.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/lib/store.ts src/lib/__tests__/store.test.ts src/lib/__tests__/fake-db.ts
git commit -m "feat(store): Supabase 쿼리 계층 store.ts (sheets.ts와 같은 함수 계약)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 일괄 처리 기록을 `bulk_logs` 테이블로

**Files:**
- Modify: `src/lib/bulk-log.ts` (전체 교체)
- Test: `src/lib/__tests__/bulk-log.test.ts` (전체 교체)

**Interfaces:**
- Consumes: `getDb` (Task 3), `kstTimestamp` (Task 1), `normalizeRowRef` (Task 4), `BulkAction`/`BulkCondition`/`BulkSnapshotItem` (`bulk.ts`)
- Produces:
  - `MAX_BULK_TARGETS = 500` (그대로)
  - `kstTimestamp` (Task 1에서 re-export)
  - `type BulkLogEntry = { jobId; at; filter; action; notify; count; snapshot; reverted; id: number }` — `rowNum` 대신 `id`
  - `type BulkLogInput = Omit<BulkLogEntry, "id">`
  - `type BulkLogRecord` — DB 행 모양 (Task 10 백업, Task 11 이전이 쓴다)
  - `toLogRecord(e: BulkLogInput): Omit<BulkLogRecord, "id">`, `fromLogRecord(r: BulkLogRecord): BulkLogEntry`, `decodeSnapshot(raw: unknown): BulkSnapshotItem[]`
  - `appendBulkLog(entry): Promise<boolean>`, `readBulkLog(limit?): Promise<BulkLogEntry[]>`, `findBulkLog(jobId): Promise<BulkLogEntry | null>`, `markBulkLogReverted(id: number, at: string): Promise<number>`
- 삭제: `BULK_LOG_TAB`, `BULK_LOG_HEADER`, `encodeSnapshot`, `toLogRow`, `parseLogRow` (시트 로그 해석은 Task 11의 `sheet-import.ts`로)

- [ ] **Step 1: 테스트 교체**

`src/lib/__tests__/bulk-log.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/bulk-log.test.ts`
Expected: FAIL — `toLogRecord is not a function` 등

- [ ] **Step 3: `src/lib/bulk-log.ts` 전체 교체**

```ts
/**
 * 일괄 처리 실행 기록 — Supabase `bulk_logs` 테이블 (2026-09-19 전: 시트 `_bulk_log` 탭).
 *
 * 되돌리기는 이 로그의 스냅샷만 보고 복원한다 — 실행 시점의 상태·알림 원값이 여기 없으면
 * 되돌릴 방법이 없으므로, run은 상태를 바꾸기 **전에** 로그를 남긴다.
 * job_id는 unique가 아니다: 되돌린 뒤 같은 대상을 다시 실행하면 같은 jobId가 또 생긴다(조회는 최신 것).
 */

import type { BulkAction, BulkCondition, BulkSnapshotItem } from "@/lib/bulk";
import { normalizeRowRef } from "@/lib/row-ref";
import { getDb } from "@/lib/supabase";

export { kstTimestamp } from "@/lib/kst-datetime";

/** 한 번에 처리할 수 있는 최대 대상 수 */
export const MAX_BULK_TARGETS = 500;

export type BulkLogEntry = {
  jobId: string;
  /** KST "YYYY-MM-DD HH:mm:ss" */
  at: string;
  /** 실행에 쓴 조건 — 직접 조건(BulkFilter) 또는 현재 목록 조건(ListFilters) */
  filter: BulkCondition;
  action: BulkAction;
  notify: boolean;
  count: number;
  snapshot: BulkSnapshotItem[];
  /** 되돌린 시각. 빈 문자열이면 아직 안 되돌림. */
  reverted: string;
  /** bulk_logs.id (되돌림 표시용) */
  id: number;
};

export type BulkLogInput = Omit<BulkLogEntry, "id">;

/** bulk_logs 행 모양 */
export type BulkLogRecord = {
  id: number;
  job_id: string;
  at: string;
  filter: unknown;
  action: string;
  notify: boolean;
  count: number;
  snapshot: unknown;
  reverted_at: string;
};

const LOG_COLUMNS = "id,job_id,at,filter,action,notify,count,snapshot,reverted_at";

/* ─── 순수 변환 ────────────────────────────────── */

export function toLogRecord(e: BulkLogInput): Omit<BulkLogRecord, "id"> {
  return {
    job_id: e.jobId,
    at: e.at,
    filter: e.filter,
    action: e.action,
    notify: e.notify,
    count: e.count,
    snapshot: e.snapshot.map((s) => ({ ref: { tab: s.ref.tab, id: s.ref.id }, status: s.status, notify: s.notify })),
    reverted_at: e.reverted,
  };
}

/** 깨진 값은 빈 배열 — 로그 한 줄 때문에 목록 전체가 죽지 않게. 하나라도 이상하면 전부 버린다. */
export function decodeSnapshot(raw: unknown): BulkSnapshotItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BulkSnapshotItem[] = [];
  for (const it of raw) {
    const item = (it ?? {}) as { ref?: unknown; status?: unknown; notify?: unknown };
    const ref = normalizeRowRef(item.ref);
    if (!ref) return [];
    out.push({
      ref,
      status: typeof item.status === "string" ? item.status : "",
      notify: typeof item.notify === "string" ? item.notify : "",
    });
  }
  return out;
}

export function fromLogRecord(r: BulkLogRecord): BulkLogEntry {
  const filter =
    r.filter && typeof r.filter === "object"
      ? (r.filter as BulkCondition)
      : ({ status: "all", type: "all" } as BulkCondition); // 조건을 못 읽어도 되돌리기는 스냅샷만 있으면 된다
  return {
    jobId: r.job_id,
    at: r.at ?? "",
    filter,
    action: (r.action as BulkAction) ?? "confirm",
    notify: r.notify === true,
    count: Number(r.count ?? 0) || 0,
    snapshot: decodeSnapshot(r.snapshot),
    reverted: (r.reverted_at ?? "").trim(),
    id: r.id,
  };
}

/* ─── DB 입출력 ────────────────────────────────── */

/** 로그 한 줄 추가. 환경변수가 없으면 false. DB 오류는 던진다. */
export async function appendBulkLog(entry: BulkLogInput): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const { error } = await db.from("bulk_logs").insert(toLogRecord(entry));
  if (error) throw error;
  return true;
}

/** 최근 실행 기록 (최신순). 읽기 실패는 throw — "기록 없음"으로 위장하지 않는다. */
export async function readBulkLog(limit = 20): Promise<BulkLogEntry[]> {
  const db = getDb();
  if (!db) return [];
  const { data, error } = await db
    .from("bulk_logs")
    .select(LOG_COLUMNS)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as BulkLogRecord[]).map(fromLogRecord);
}

/** jobId로 로그 한 줄 찾기 (같은 jobId가 여럿이면 가장 최근 것). */
export async function findBulkLog(jobId: string): Promise<BulkLogEntry | null> {
  const db = getDb();
  if (!db) return null;
  const { data, error } = await db
    .from("bulk_logs")
    .select(LOG_COLUMNS)
    .eq("job_id", jobId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? fromLogRecord(data as BulkLogRecord) : null;
}

/** 되돌림 시각을 적는다. 반환: 갱신된 행 수. */
export async function markBulkLogReverted(id: number, at: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const { data, error } = await db.from("bulk_logs").update({ reverted_at: at }).eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/bulk-log.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/bulk-log.ts src/lib/__tests__/bulk-log.test.ts
git commit -m "feat(store): 일괄 처리 기록을 bulk_logs 테이블로

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 라우트를 `store.ts`로 전환하고 `sheets.ts` 삭제

**Files:**
- Modify: `src/lib/messaging.ts` (import 1줄)
- Modify: `src/app/api/booking/route.ts`, `src/app/api/payment/confirm/route.ts` (ref 전달)
- Modify: `src/app/api/retreat/route.ts`, `src/app/api/open-stay/route.ts`, `src/app/api/booking-check/route.ts`, `src/app/api/calendar/[filename]/route.ts`, `src/app/api/cron/morning-digest/route.ts`, `src/app/api/admin/bookings/route.ts`, `src/app/api/admin/status/route.ts`, `src/app/api/admin/resend/route.ts` (import·문구)
- Modify: `src/app/api/admin/bulk/route.ts`, `src/app/api/admin/bulk/revert/route.ts` (패치)
- Modify: `src/app/api/program-counts/route.ts`, `src/app/api/cron/stay-reminder/route.ts`, `src/app/api/cron/stay-checkout/route.ts` (구글 API 직접 호출 제거)
- Delete: `src/lib/sheets.ts`, `src/lib/__tests__/sheets.test.ts`
- Test: `src/app/api/booking/__tests__/route.test.ts`, `src/app/api/payment/confirm/__tests__/route.test.ts`

**Interfaces:**
- Consumes: Task 6의 `store.ts` 전체, Task 7의 `bulk-log.ts`, Task 4의 `BulkPlan.patches`/`planRevertWrites`
- Produces: 되돌리기 응답 `{ ok, jobId, restored, updated, at }` (`cellsUpdated` → `updated`)

- [ ] **Step 1: 신청 라우트가 ref를 넘기는지 보는 실패 테스트 작성**

`src/app/api/booking/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  appendBooking: vi.fn(),
  notifyBooking: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ appendBooking: mocks.appendBooking }));
vi.mock("@/lib/messaging", () => ({ notifyBooking: mocks.notifyBooking }));
vi.mock("@/lib/email", () => ({
  sendOperatorAlert: vi.fn(async () => {}),
  sendGuestConfirmation: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/booking/route";

beforeEach(() => {
  mocks.appendBooking.mockReset();
  mocks.notifyBooking.mockReset();
});

describe("POST /api/booking", () => {
  it("저장한 행의 ref로 알림 결과를 기록한다 — 같은 연락처의 다른 예약에 붙지 않게", async () => {
    mocks.appendBooking.mockResolvedValue({ tab: "살롱", id: 42 });
    mocks.notifyBooking.mockResolvedValue({ guest: "ok", host: "ok" });

    const res = await POST(
      new NextRequest("http://localhost/api/booking", {
        method: "POST",
        body: JSON.stringify({ type: "salon", name: "홍", phone: "010-1", program: "p", totalAmount: 30000 }),
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.notifyBooking).toHaveBeenCalledWith(
      "received",
      expect.objectContaining({ name: "홍" }),
      { ref: { tab: "살롱", id: 42 } }
    );
  });

  it("저장을 건너뛰면(null) ref 없이 부른다", async () => {
    mocks.appendBooking.mockResolvedValue(null);
    mocks.notifyBooking.mockResolvedValue({ guest: "ok", host: "ok" });
    await POST(
      new NextRequest("http://localhost/api/booking", {
        method: "POST",
        body: JSON.stringify({ type: "stay", name: "홍", phone: "010-1", totalAmount: 1 }),
      })
    );
    expect(mocks.notifyBooking.mock.calls[0][2]).toEqual({ ref: undefined });
  });
});
```

`src/app/api/payment/confirm/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  appendBooking: vi.fn(),
  notifyBooking: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ appendBooking: mocks.appendBooking }));
vi.mock("@/lib/messaging", () => ({ notifyBooking: mocks.notifyBooking }));
vi.mock("@/lib/email", () => ({
  sendOperatorAlert: vi.fn(async () => {}),
  sendGuestConfirmation: vi.fn(async () => {}),
}));

import { POST } from "@/app/api/payment/confirm/route";

const realFetch = globalThis.fetch;
beforeEach(() => {
  mocks.appendBooking.mockReset();
  mocks.notifyBooking.mockReset();
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ paymentKey: "pk", orderId: "o1", method: "카드" }), { status: 200 })
  ) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("POST /api/payment/confirm", () => {
  it("결제 승인 후 저장한 행의 ref로 확정 알림을 기록한다", async () => {
    mocks.appendBooking.mockResolvedValue({ tab: "스테이", id: 7 });
    mocks.notifyBooking.mockResolvedValue({ guest: "ok", host: "ok" });

    const res = await POST(
      new NextRequest("http://localhost/api/payment/confirm", {
        method: "POST",
        body: JSON.stringify({
          paymentKey: "pk", orderId: "o1", amount: 240000,
          bookingData: { type: "stay", name: "홍", phone: "010-1", room: "옥순방" },
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.notifyBooking).toHaveBeenCalledWith(
      "confirmed",
      expect.objectContaining({ via: "toss" }),
      { ref: { tab: "스테이", id: 7 } }
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/api/booking src/app/api/payment`
Expected: FAIL — 라우트가 아직 `@/lib/sheets`를 import하고, `notifyBooking`에 세 번째 인자를 넘기지 않는다.

- [ ] **Step 3: 신청·결제 라우트 수정**

`src/app/api/booking/route.ts`:
- `import { appendBooking } from "@/lib/sheets";` → `import { appendBooking } from "@/lib/store";`
- `// ── 1. 구글 시트에 저장 (알림 실패가 저장을 막지 않도록 먼저) ──` → `// ── 1. DB에 저장 (알림 실패가 저장을 막지 않도록 먼저) ──`
- `await appendBooking({` → `const ref = await appendBooking({`
- `// ── 2. 접수 알림톡/문자 발송 + O열 기록 ─────────────` → `// ── 2. 접수 알림톡/문자 발송 + 방금 저장한 행에 결과 기록 ──`
- `notifyBooking("received", { ... via: "web", });`의 닫는 부분 `});`를 `}, { ref: ref ?? undefined });`로 바꾼다.

`src/app/api/payment/confirm/route.ts`:
- `import { appendBooking } from "@/lib/sheets";` → `import { appendBooking } from "@/lib/store";`
- `await appendBooking({` → `const ref = await appendBooking({`
- `// ── 3. 확정 알림톡/문자 발송 + O열 기록 ─────────` → `// ── 3. 확정 알림톡/문자 발송 + 방금 저장한 행에 결과 기록 ──`
- `notifyBooking("confirmed", { ... via: "toss", });`의 닫는 부분을 `}, { ref: ref ?? undefined });`로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/api/booking src/app/api/payment`
Expected: PASS

- [ ] **Step 5: import만 바꾸는 파일들**

아래 파일에서 `from "@/lib/sheets"`를 `from "@/lib/store"`로 바꾼다. 다른 코드는 그대로다.
- `src/lib/messaging.ts`
- `src/app/api/retreat/route.ts`
- `src/app/api/open-stay/route.ts`
- `src/app/api/booking-check/route.ts`
- `src/app/api/calendar/[filename]/route.ts`
- `src/app/api/cron/morning-digest/route.ts`
- `src/app/api/admin/bookings/route.ts`
- `src/app/api/admin/status/route.ts`

`src/lib/messaging.ts`의 `console.error("[NOTIFY] 시트 기록 실패", e);` → `console.error("[NOTIFY] 알림 결과 기록 실패", e);`

`src/app/api/admin/bookings/route.ts`의 주석 둘째 문단을 바꾼다:

```ts
 * meta는 rows와 **길이·순서가 같다**(meta[0]은 헤더 자리, id 0). 각 원소는 { tab, id } —
 * 그 행의 탭과 DB id다. 상태 변경·재발송 때 body의 ref로 그대로 넘기면
 * 연락처가 빈 행도 정확히 찾아 쓴다. retreatMeta·openMeta도 같은 규칙.
```

`src/app/api/admin/status/route.ts`:
- 주석의 `ref?: { tab: "살롱"|"스테이"|"리트릿"|"무료개방"; rowNum: number } }` → `ref?: { tab: "살롱"|"스테이"|"리트릿"|"무료개방"; id: number } }`
- 주석 `ref(목록 응답의 meta 원소)가 있으면 시트 행 번호로 직접 읽고 쓴다` → `ref(목록 응답의 meta 원소)가 있으면 DB id로 직접 읽고 쓴다`
- `// 현재 시트 상태 확인 (중복 처리 방지)` → `// 현재 상태 확인 (중복 처리 방지)`
- `"시트에서 예약 행을 찾지 못했습니다."` → `"예약 행을 찾지 못했습니다."`
- `// 취소 사유는 요청사항(M열)에 남긴다.` → `// 취소 사유는 요청사항에 남긴다.`
- `O열엔 "🔕 HH:MM 확정 알림 없음"을 남긴다.` → `알림 칸엔 "🔕 HH:MM 확정 알림 없음"을 남긴다.`
- `handleSimpleSheet` 주석 `행 식별은 ref(시트 행 번호) 우선` → `행 식별은 ref(DB id) 우선`
- `"시트에서 신청 행을 찾지 못했습니다."` → `"신청 행을 찾지 못했습니다."`

`src/app/api/admin/resend/route.ts`:
- 주석 `body: { row: string[]; ref?: { tab: "살롱"|"스테이"; rowNum: number } }` → `body: { row: string[]; ref?: { tab: "살롱"|"스테이"; id: number } }`
- 주석 `ref  — 목록 응답의 meta 원소. 있으면 O열 기록을 그 행에 직접 한다.` → `ref  — 목록 응답의 meta 원소. 있으면 알림 결과를 그 행에 직접 기록한다.`

- [ ] **Step 6: 일괄 처리 라우트 수정**

`src/app/api/admin/bulk/route.ts`:
- import 교체:
  ```ts
  import { applyPatches, getAllBookingsWithMeta } from "@/lib/store";
  import type { BookingPatch, RowRef } from "@/lib/row-ref";
  ```
  (`import { batchUpdateCells, getAllBookingsWithMeta } from "@/lib/sheets";`와 `import { refCellRange, type RowRef } from "@/lib/row-ref";` 두 줄을 지운다)
- `const refKey = (r: RowRef) => `${r.tab}#${r.rowNum}`;` → `const refKey = (r: RowRef) => `${r.tab}#${r.id}`;`
- 머리 주석의 **쿼터 규약** 문단을 바꾼다:
  ```ts
   * **쓰기 규약(중요)**: 2026-09-10 운영에서 99건을 건별 API로 돌렸다가 읽기 쿼터(429)에 걸렸다.
   * 그래서 run은 **읽기 1회 + applyPatches 1회**로 끝낸다. applyPatches는 한 트랜잭션이라
   * 전부 반영되거나 하나도 반영되지 않는다. notify:true여도 `notifyBooking(..., { recordToSheet: false })`로
   * 발송만 하고 알림 칸은 맨 끝에 applyPatches 한 번으로 몰아 쓴다.
   *
   * GET → bulk_logs 최근 20건.
  ```
- GET의 주석 `// readBulkLog는 탭이 아직 없을 때만 빈 배열을 준다. 권한·쿼터 오류는 던져서 500으로 드러난다` → `// readBulkLog는 DB 오류를 던진다 — 500으로 드러낸다.`
- GET의 오류 문구 `"실행 기록을 읽지 못했습니다(시트 오류)."` → `"실행 기록을 읽지 못했습니다(DB 오류)."`
- `// 쓰기 1회` 아래 줄: `if (plan.writes.length > 0) await batchUpdateCells(plan.writes);` → `if (plan.patches.length > 0) await applyPatches(plan.patches);`
- `const notifyCells: { range: string; values: string[][] }[] = [];` → `const notifyPatches: BookingPatch[] = [];`
- `// recordToSheet:false — O열은 아래에서 batchUpdate 한 번으로 몰아 쓴다(행당 읽기 0).` → `// recordToSheet:false — 알림 칸은 아래에서 applyPatches 한 번으로 몰아 쓴다(행당 읽기 0).`
- `notifyCells.push({ range: refCellRange(ref, "O"), values: [[notifyStatusText(resolved.event, result)]] });` → `notifyPatches.push({ ref, notify: notifyStatusText(resolved.event, result) });`
- `if (notifyCells.length > 0) { try { await batchUpdateCells(notifyCells); } ...` → `if (notifyPatches.length > 0) { try { await applyPatches(notifyPatches); } ...` (catch 블록 그대로)

`src/app/api/admin/bulk/revert/route.ts`:
- `import { batchUpdateCells } from "@/lib/sheets";` → `import { applyPatches } from "@/lib/store";`
- 머리 주석:
  ```ts
  /**
   * 일괄 처리 되돌리기 — bulk_logs의 스냅샷(실행 직전 상태·알림 원값)을 그대로 다시 쓴다.
   * 알림은 보내지 않는다.
   *
   * body: { jobId: string }
   * res:  { ok: true; jobId; restored; updated; at } | { ok: false; error }
   * 400 jobId 없음 / 404 로그 없음 / 409 이미 되돌림
   *
   * 읽기 1회(로그) + applyPatches 1회(한 트랜잭션) + 로그 표시 1회.
   */
  ```
- `// 읽기 실패와 "기록 없음"을 구분한다. 시트 오류를 404로 보여주면` → `// 읽기 실패와 "기록 없음"을 구분한다. DB 오류를 404로 보여주면`
- `"실행 기록을 읽지 못했습니다(시트 오류). 잠시 후 다시 시도해주세요."` → `"실행 기록을 읽지 못했습니다(DB 오류). 잠시 후 다시 시도해주세요."`
- `const cellsUpdated = await batchUpdateCells(planRevertWrites(entry.snapshot));` → `const updated = await applyPatches(planRevertWrites(entry.snapshot));`
- `await markBulkLogReverted(entry.rowNum, at);` → `await markBulkLogReverted(entry.id, at);`
- 응답의 `cellsUpdated,` → `updated,`

- [ ] **Step 7: 구글 API를 직접 부르던 라우트 3개 교체**

`src/app/api/program-counts/route.ts` 전체:

```ts
import { NextResponse } from "next/server";
import { getAllBookings } from "@/lib/store";

/** 살롱 프로그램별 신청 인원 (취소 제외) */
export async function GET() {
  try {
    const rows = await getAllBookings();
    const counts: Record<string, number> = {};

    for (const row of rows) {
      if (!row[0] || row[0] === "신청일시") continue;
      if (row[1] !== "살롱") continue;
      const status = row[13] ?? "";
      if (status === "취소") continue;
      const program = row[4] ?? "";
      if (!program) continue;
      counts[program] = (counts[program] ?? 0) + 1;
    }

    return NextResponse.json({ counts });
  } catch (e) {
    console.error("[program-counts]", e);
    return NextResponse.json({ counts: {} });
  }
}
```

`src/app/api/cron/stay-reminder/route.ts`:
- `import { google } from "googleapis";` → `import { getAllBookings } from "@/lib/store";`
- 아래 블록을 지운다:
  ```ts
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ skipped: true, reason: "no sheets config" });
  }
  ```
- `const credentials = ...`부터 `const rows = (res.data.values as string[][] | null) ?? [];`까지를 아래로 바꾼다:
  ```ts
  // 스테이만. 행 판정(!row[0] 건너뛰기 포함)은 시트 시절 그대로 둔다 —
  // 신청일시가 빈 수기 입력 행에 안내 문자가 새로 나가지 않게.
  const rows = (await getAllBookings()).filter((row) => row[1] === "스테이");
  ```

`src/app/api/cron/stay-checkout/route.ts`: 위와 똑같이 바꾼다(import, 환경변수 블록 삭제, `rows` 만들기).

- [ ] **Step 8: `sheets.ts` 삭제**

```bash
git rm src/lib/sheets.ts src/lib/__tests__/sheets.test.ts
grep -rn -e '@/lib/sheets' -e 'from "googleapis"' src || echo "no references"
```

Expected: `no references`

- [ ] **Step 9: 전체 검증**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 셋 다 통과. 타입 오류가 나면 오류 파일에서 `rowNum`, `writes`, `batchUpdateCells`, `cellsUpdated`가 남아 있는지 찾아 위 규칙대로 고친다.

- [ ] **Step 10: 커밋**

```bash
git add -A src
git commit -m "feat(store): 모든 라우트를 Supabase store로 전환, sheets.ts 삭제

- 신청·결제 라우트는 저장한 행의 ref로 알림 결과를 기록
- 일괄 처리·되돌리기는 applyPatches(한 트랜잭션)
- program-counts·stay-reminder·stay-checkout의 구글 API 직접 호출 제거

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: DB 실패 경고 + 매일 DB 점검 cron

**Files:**
- Create: `src/lib/db-alert.ts`
- Modify: `src/lib/email.ts` (`sendOperatorNotice` 추가)
- Modify: `src/lib/store.ts` (`checkDbHealth` 추가, 저장 실패 시 경고)
- Create: `src/app/api/cron/db-health/route.ts`
- Modify: `vercel.json`
- Test: `src/lib/__tests__/db-alert.test.ts`, `src/app/api/cron/db-health/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `postSlack` (`src/lib/slack.ts`), `buildSimpleBlocks(title, fields, note?)` (`src/lib/slack-blocks.ts`)
- Produces:
  - `sendOperatorNotice(subject: string, text: string, opts?: { to?: string; attachments?: { filename: string; content: Buffer }[] }): Promise<void>` — Resend 키가 없으면 경고만, 전송 오류는 throw
  - `DB_ALERT_THROTTLE_MS = 600000`
  - `reportDbFailure(context: string, err: unknown, now?: number): Promise<"slack" | "email" | "throttled" | "failed">`
  - `resetDbAlertThrottle(): void` (테스트용)
  - `checkDbHealth(): Promise<{ ok: true; tables: string[] } | { ok: false; table: string; error: unknown }>` (store.ts)
  - `HEALTH_TABLES = ["bookings", "retreats", "open_stays", "bulk_logs"] as const` (store.ts)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/db-alert.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  postSlack: vi.fn(),
  sendOperatorNotice: vi.fn(),
}));
vi.mock("@/lib/slack", () => ({ postSlack: mocks.postSlack }));
vi.mock("@/lib/email", () => ({ sendOperatorNotice: mocks.sendOperatorNotice }));

import { DB_ALERT_THROTTLE_MS, reportDbFailure, resetDbAlertThrottle } from "@/lib/db-alert";

beforeEach(() => {
  resetDbAlertThrottle();
  mocks.postSlack.mockReset();
  mocks.sendOperatorNotice.mockReset();
});

describe("reportDbFailure", () => {
  it("슬랙이 되면 슬랙으로, 일시정지 확인 안내를 넣는다", async () => {
    mocks.postSlack.mockResolvedValue({ ok: true });
    expect(await reportDbFailure("예약 저장", new Error("fetch failed"), 1_000)).toBe("slack");
    const msg = mocks.postSlack.mock.calls[0][0];
    expect(msg.text).toContain("DB 연결 실패");
    expect(JSON.stringify(msg.blocks)).toContain("Restore");
    expect(JSON.stringify(msg.blocks)).toContain("fetch failed");
  });

  it("슬랙이 안 되면 운영자 메일로", async () => {
    mocks.postSlack.mockResolvedValue({ ok: false, error: "not-configured" });
    mocks.sendOperatorNotice.mockResolvedValue(undefined);
    expect(await reportDbFailure("예약 저장", { message: "paused" }, 1_000)).toBe("email");
    expect(mocks.sendOperatorNotice.mock.calls[0][0]).toContain("DB 연결 실패");
    expect(mocks.sendOperatorNotice.mock.calls[0][1]).toContain("paused");
  });

  it("10분 안에는 다시 보내지 않는다 (신청이 몰릴 때 폭탄 방지)", async () => {
    mocks.postSlack.mockResolvedValue({ ok: true });
    await reportDbFailure("a", "x", 1_000);
    expect(await reportDbFailure("b", "x", 1_000 + DB_ALERT_THROTTLE_MS - 1)).toBe("throttled");
    expect(await reportDbFailure("c", "x", 1_000 + DB_ALERT_THROTTLE_MS)).toBe("slack");
    expect(mocks.postSlack).toHaveBeenCalledTimes(2);
  });

  it("둘 다 실패해도 던지지 않는다 — 원래 오류 처리를 가리지 않게", async () => {
    mocks.postSlack.mockRejectedValue(new Error("net"));
    mocks.sendOperatorNotice.mockRejectedValue(new Error("mail"));
    expect(await reportDbFailure("a", "x", 1_000)).toBe("failed");
  });
});
```

`src/app/api/cron/db-health/__tests__/route.test.ts`:

```ts
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
```

`src/lib/__tests__/store.test.ts` 끝에 추가:

```ts
import { checkDbHealth, HEALTH_TABLES } from "@/lib/store";

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
```

(`import` 줄은 파일 위쪽 `@/lib/store` import에 `checkDbHealth, HEALTH_TABLES`를 합쳐 넣는다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/db-alert.test.ts src/app/api/cron/db-health src/lib/__tests__/store.test.ts`
Expected: FAIL — 모듈·함수 없음

- [ ] **Step 3: `sendOperatorNotice` 추가**

`src/lib/email.ts` 맨 끝에 추가:

```ts
/* ─── 운영 알림 (DB 장애·주간 백업) ─────────────── */

/**
 * 운영자에게 텍스트 메일을 보낸다. 첨부파일(주간 백업 JSON)도 받는다.
 * RESEND_API_KEY가 없으면 경고만 남긴다. 전송 오류는 던진다 — 호출부가 실패를 알아야 한다.
 */
export async function sendOperatorNotice(
  subject: string,
  text: string,
  opts: { to?: string; attachments?: { filename: string; content: Buffer }[] } = {}
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[EMAIL] RESEND_API_KEY 미설정 — 운영 알림 메일 건너뜀:", subject);
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [opts.to || OPERATOR_EMAIL],
    subject,
    text,
    attachments: opts.attachments,
  });
  if (error) throw new Error(`[EMAIL] ${error.message}`);
}
```

- [ ] **Step 4: `db-alert.ts` 작성**

`src/lib/db-alert.ts`:

```ts
/**
 * DB(Supabase) 장애 경고 — 손님 신청이 실패했는데 아무도 모르는 상황을 막는다.
 *
 * 무료 플랜은 7일 동안 활동이 없으면 프로젝트가 일시정지된다. 그러면 모든 저장이 실패하므로
 * 경고에 "대시보드에서 Restore" 안내를 넣는다. 슬랙이 1순위, 안 되면 운영자 메일.
 * 신청이 몰릴 때 경고가 쏟아지지 않게 10분에 한 번으로 제한한다(인스턴스 단위).
 */

import { sendOperatorNotice } from "@/lib/email";
import { postSlack } from "@/lib/slack";
import { buildSimpleBlocks } from "@/lib/slack-blocks";

export const DB_ALERT_THROTTLE_MS = 10 * 60 * 1000;

const HINT =
  "Supabase 대시보드에서 프로젝트가 일시정지됐는지 확인하세요(Paused면 Restore 버튼). 복구 절차: docs/runbook-supabase.md";

let lastSentAt: number | null = null;

/** 테스트용 — 제한 시계를 되돌린다 */
export function resetDbAlertThrottle(): void {
  lastSentAt = null;
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}

/** 경고를 보낸다. 절대 던지지 않는다 — 호출부의 원래 오류 처리를 가리면 안 된다. */
export async function reportDbFailure(
  context: string,
  err: unknown,
  now: number = Date.now()
): Promise<"slack" | "email" | "throttled" | "failed"> {
  if (lastSentAt !== null && now - lastSentAt < DB_ALERT_THROTTLE_MS) return "throttled";
  lastSentAt = now;

  const detail = errorText(err);
  console.error(`[DB-ALERT] ${context}: ${detail}`);

  try {
    const res = await postSlack(
      buildSimpleBlocks(
        "🚨 DB 연결 실패",
        [
          { label: "작업", value: context },
          { label: "오류", value: detail },
        ],
        HINT
      )
    );
    if (res.ok) return "slack";
  } catch (e) {
    console.error("[DB-ALERT] 슬랙 전송 실패", e);
  }

  try {
    await sendOperatorNotice("[코이노니아] DB 연결 실패", `작업: ${context}\n오류: ${detail}\n\n${HINT}`);
    return "email";
  } catch (e) {
    console.error("[DB-ALERT] 메일 전송 실패", e);
    return "failed";
  }
}
```

`buildSimpleBlocks`가 돌려주는 `SlackMessage.text`에 제목이 들어가는지 확인한다: `grep -n "text:" src/lib/slack-blocks.ts`. 제목이 `text`에 안 들어가면 테스트의 `msg.text` 검사를 `JSON.stringify(msg)`로 바꾼다.

- [ ] **Step 5: store.ts에 점검 함수와 저장 실패 경고 추가**

`src/lib/store.ts`:
- import에 `import { reportDbFailure } from "@/lib/db-alert";` 추가
- `insertOne`을 아래로 교체(세 append 함수가 모두 이 함수를 거친다):

```ts
async function insertOne(table: Table, values: object): Promise<{ id: number; kind?: BookingKind }> {
  const { data, error } = await getDb()!.from(table).insert(values).select("id,kind").single();
  if (error) {
    // 손님 신청이 저장되지 않았다 — 운영자가 바로 알아야 한다(무료 플랜 일시정지 등).
    await reportDbFailure(`신청 저장 (${table})`, error);
    throw error;
  }
  return data as { id: number; kind?: BookingKind };
}
```

- 파일 끝에 추가:

```ts
/* ─── 점검 ─────────────────────────────────────── */

export const HEALTH_TABLES = ["bookings", "retreats", "open_stays", "bulk_logs"] as const;

/**
 * 네 테이블을 한 번씩 조회한다. 매일 cron이 불러 무료 플랜의 7일 무활동 일시정지를 막고,
 * 실패하면 cron이 경고를 보낸다. 환경변수 누락도 실패로 본다.
 */
export async function checkDbHealth(): Promise<
  { ok: true; tables: string[] } | { ok: false; table: string; error: unknown }
> {
  const db = getDb();
  if (!db) {
    return { ok: false, table: "-", error: new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정") };
  }
  for (const table of HEALTH_TABLES) {
    const { error } = await db.from(table).select("id").limit(1);
    if (error) return { ok: false, table, error };
  }
  return { ok: true, tables: [...HEALTH_TABLES] };
}
```

`src/lib/__tests__/store.test.ts` 위쪽에 db-alert 모킹을 추가한다(저장 실패 테스트가 실제 슬랙을 부르지 않게):

```ts
vi.mock("@/lib/db-alert", () => ({ reportDbFailure: vi.fn(async () => "slack") }));
```

- [ ] **Step 6: cron 라우트 작성**

`src/app/api/cron/db-health/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { reportDbFailure } from "@/lib/db-alert";
import { checkDbHealth } from "@/lib/store";

/**
 * 매일 DB 점검 (Vercel Cron). 두 가지 일을 한다.
 * 1. 매일 조회가 있으니 Supabase 무료 플랜의 7일 무활동 일시정지가 걸리지 않는다.
 * 2. 조회가 실패하면(일시정지·키 오류·장애) 운영자에게 경고를 보낸다.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkDbHealth();
  if (!result.ok) {
    await reportDbFailure(`매일 DB 점검 (${result.table})`, result.error);
    return NextResponse.json({ ok: false, table: result.table }, { status: 503 });
  }
  return NextResponse.json({ ok: true, checked: result.tables });
}
```

`vercel.json`의 `crons` 배열 끝에 추가(06:00 KST):

```json
    {
      "path": "/api/cron/db-health",
      "schedule": "0 21 * * *"
    }
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run src/lib/__tests__/db-alert.test.ts src/app/api/cron/db-health src/lib/__tests__/store.test.ts && npm run typecheck`
Expected: PASS, 타입 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/lib/db-alert.ts src/lib/email.ts src/lib/store.ts src/app/api/cron/db-health vercel.json \
  src/lib/__tests__/db-alert.test.ts src/lib/__tests__/store.test.ts
git commit -m "feat(ops): DB 장애 경고 + 매일 DB 점검 cron (무료 플랜 일시정지 방지)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: 주간 백업 메일 + 복구 스크립트 + 운영 문서

**Files:**
- Create: `src/lib/backup.ts`
- Modify: `src/lib/store.ts` (`dumpAllTables` 추가)
- Create: `src/app/api/cron/weekly-backup/route.ts`
- Modify: `vercel.json`
- Create: `scripts/restore-backup.ts`
- Create: `docs/runbook-supabase.md`
- Test: `src/lib/__tests__/backup.test.ts`, `src/app/api/cron/weekly-backup/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `kstTimestamp` (Task 1), `fetchAllPages` (Task 2), `sendOperatorNotice` (Task 9), `reportDbFailure` (Task 9)
- Produces:
  - `BACKUP_TABLES = ["bookings", "retreats", "open_stays", "bulk_logs"] as const`, `type BackupTable`
  - `type BackupData = Record<BackupTable, Record<string, unknown>[]>`
  - `BACKUP_WARN_BYTES = 10 * 1024 * 1024`
  - `buildBackup(tables: BackupData, now: Date): { filename; json; bytes; counts; tooLarge }`
  - `parseBackup(json: string): BackupData` — 형식이 틀리면 throw
  - `restorableRows(rows): Record<string, unknown>[]` — 생성 컬럼 `phone_digits` 제거
  - `dumpAllTables(): Promise<BackupData>` (store.ts)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/backup.test.ts`:

```ts
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
```

`src/app/api/cron/weekly-backup/__tests__/route.test.ts`:

```ts
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
    const res = await GET(req());
    expect(res.status).toBe(200);

    const [subject, text, opts] = mocks.sendOperatorNotice.mock.calls[0];
    expect(subject).toContain("주간 백업");
    expect(text).toContain("bookings 1건");
    expect(opts.to).toBe("backup@example.com");
    const body = JSON.parse(opts.attachments[0].content.toString());
    expect(Object.keys(body.tables)).toEqual(["bookings", "retreats", "open_stays", "bulk_logs"]);
  });

  it("실패하면 경고를 보내고 500", async () => {
    mocks.dumpAllTables.mockRejectedValue({ message: "paused" });
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(mocks.reportDbFailure).toHaveBeenCalledWith("주간 백업", { message: "paused" });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/backup.test.ts src/app/api/cron/weekly-backup`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `backup.ts` 작성**

`src/lib/backup.ts`:

```ts
/**
 * 주간 백업 파일 — 순수 로직 (cron과 복구 스크립트가 같이 쓴다).
 *
 * Supabase 무료 플랜은 백업을 내려받을 수 없다. 그래서 매주 네 테이블 전체를
 * JSON 파일 하나로 묶어 운영자 메일에 첨부한다. 복구는 scripts/restore-backup.ts.
 * 이 파일은 server-only 모듈을 import하지 않는다(스크립트에서도 쓴다).
 */

import { kstTimestamp } from "@/lib/kst-datetime";

export const BACKUP_TABLES = ["bookings", "retreats", "open_stays", "bulk_logs"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupData = Record<BackupTable, Record<string, unknown>[]>;

/** 메일 첨부 한도(40MB)보다 한참 아래에서 미리 경고한다 */
export const BACKUP_WARN_BYTES = 10 * 1024 * 1024;

/** DB가 계산하는 컬럼 — 복구 때 넣으면 오류가 난다 */
const GENERATED_COLUMNS = ["phone_digits"];

export function buildBackup(tables: BackupData, now: Date) {
  const json = JSON.stringify({ version: 1, createdAt: now.toISOString(), tables });
  const bytes = Buffer.byteLength(json);
  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, tables[t].length])) as Record<BackupTable, number>;
  return {
    filename: `koinonia-backup-${kstTimestamp(now).slice(0, 10)}.json`,
    json,
    bytes,
    counts,
    tooLarge: bytes > BACKUP_WARN_BYTES,
  };
}

export function parseBackup(json: string): BackupData {
  const parsed = JSON.parse(json) as { version?: unknown; tables?: Record<string, unknown> };
  if (parsed?.version !== 1 || !parsed.tables || typeof parsed.tables !== "object") {
    throw new Error("코이노니아 백업 파일이 아닙니다 (version/tables 없음).");
  }
  const out = {} as BackupData;
  for (const t of BACKUP_TABLES) {
    const rows = parsed.tables[t];
    if (!Array.isArray(rows)) throw new Error(`백업 파일에 ${t} 테이블이 없습니다.`);
    out[t] = rows as Record<string, unknown>[];
  }
  return out;
}

export function restorableRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const copy = { ...r };
    for (const c of GENERATED_COLUMNS) delete copy[c];
    return copy;
  });
}
```

- [ ] **Step 4: store.ts에 `dumpAllTables` 추가**

`src/lib/store.ts`:
- `type Table = "bookings" | "retreats" | "open_stays";` → `type Table = "bookings" | "retreats" | "open_stays" | "bulk_logs";`
- import에 `import { BACKUP_TABLES, type BackupData } from "@/lib/backup";` 추가
- 파일 끝에 추가:

```ts
/* ─── 백업 ─────────────────────────────────────── */

/** 네 테이블 전체(모든 컬럼)를 끝까지 읽는다. 주간 백업 cron용. */
export async function dumpAllTables(): Promise<BackupData> {
  if (!getDb()) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정");
  const out = {} as BackupData;
  for (const t of BACKUP_TABLES) {
    out[t] = await allRows<Record<string, unknown>>(t, "*");
  }
  return out;
}
```

- [ ] **Step 5: cron 라우트 작성**

`src/app/api/cron/weekly-backup/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { BACKUP_TABLES, buildBackup } from "@/lib/backup";
import { reportDbFailure } from "@/lib/db-alert";
import { sendOperatorNotice } from "@/lib/email";
import { dumpAllTables } from "@/lib/store";

/**
 * 주간 백업 (Vercel Cron, 월요일 03:00 KST).
 * 무료 플랜은 백업을 내려받을 수 없어서, 네 테이블 전체를 JSON으로 운영자 메일에 첨부한다.
 * 받는 곳: BACKUP_EMAIL, 없으면 OPERATOR_EMAIL. 연락처가 들어 있으니 운영자 전용 메일함으로.
 * 복구: docs/runbook-supabase.md
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backup = buildBackup(await dumpAllTables(), new Date());
    const lines = BACKUP_TABLES.map((t) => `- ${t} ${backup.counts[t]}건`);
    const warn = backup.tooLarge
      ? `\n⚠ 백업 파일이 ${(backup.bytes / 1024 / 1024).toFixed(1)}MB입니다. 메일 첨부 한도(40MB)에 가까워지면 백업 방식을 바꿔야 합니다.\n`
      : "";

    await sendOperatorNotice(
      `[코이노니아] 주간 백업 ${backup.filename.slice(16, 26)}`,
      `첨부된 JSON 파일이 이번 주 전체 데이터입니다. 지우지 말고 보관해주세요.\n\n${lines.join("\n")}\n${warn}\n복구 방법: docs/runbook-supabase.md`,
      {
        to: process.env.BACKUP_EMAIL || undefined,
        attachments: [{ filename: backup.filename, content: Buffer.from(backup.json) }],
      }
    );

    return NextResponse.json({ ok: true, counts: backup.counts, bytes: backup.bytes });
  } catch (e) {
    await reportDbFailure("주간 백업", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
```

`vercel.json`의 `crons` 배열 끝에 추가(일요일 18:00 UTC = 월요일 03:00 KST):

```json
    {
      "path": "/api/cron/weekly-backup",
      "schedule": "0 18 * * 0"
    }
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/lib/__tests__/backup.test.ts src/app/api/cron/weekly-backup && npm run typecheck`
Expected: PASS

- [ ] **Step 7: 복구 스크립트 작성**

`scripts/restore-backup.ts`:

```ts
/**
 * 주간 백업 JSON → Supabase 복구.
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json> --dry-run
 *   npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json>
 *
 * - 원래 id 그대로 넣는다. 이미 있는 id는 건너뛴다(덮어쓰지 않음).
 * - 끝나면 reset_id_sequences()로 다음 id가 겹치지 않게 맞춘다.
 * - server-only 모듈(store/supabase)은 import하지 않는다.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { BACKUP_TABLES, parseBackup, restorableRows } from "@/lib/backup";

const CHUNK = 500;

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`환경변수 ${name}이(가) 없습니다. --env-file=.env.local 을 붙였는지 확인하세요.`);
    process.exit(2);
  }
  return v;
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const dry = process.argv.includes("--dry-run");
  if (!file) {
    console.error("사용: npx tsx --env-file=.env.local scripts/restore-backup.ts <백업파일.json> [--dry-run]");
    process.exit(2);
  }

  const data = parseBackup(readFileSync(file, "utf8"));
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of BACKUP_TABLES) {
    const rows = restorableRows(data[table]);
    console.log(`${table}: 백업 ${rows.length}건`);
    if (dry) continue;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db
        .from(table)
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    }
  }

  if (dry) {
    console.log("\n(드라이런) 아무것도 쓰지 않았습니다.");
    return;
  }

  const { error } = await db.rpc("reset_id_sequences");
  if (error) throw error;
  console.log("\n✓ 복구 완료. id 시퀀스를 맞췄습니다.");
}

main().catch((e) => {
  console.error("✗ 복구 실패:", e);
  process.exit(1);
});
```

- [ ] **Step 8: 운영 문서 작성**

`docs/runbook-supabase.md`:

````markdown
# Supabase 운영 가이드

예약 데이터는 2026-09-19부터 Supabase(Postgres)에 있다. 구글 시트는 보관용이다.
설계: `docs/superpowers/specs/2026-09-19-supabase-migration-design.md`

## 환경변수

| 이름 | 어디서 | 비고 |
|---|---|---|
| `SUPABASE_URL` | 대시보드 > Project Settings > API > Project URL | |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 화면의 service_role 키(또는 secret 키 `sb_secret_…`) | 서버 전용. `NEXT_PUBLIC_` 금지 |
| `BACKUP_EMAIL` | 주간 백업을 받을 메일 | 비우면 `OPERATOR_EMAIL` |

Vercel: Project > Settings > Environment Variables에 Production·Preview 둘 다 넣는다.

## "DB 연결 실패" 경고를 받았을 때

1. Supabase 대시보드를 연다. 프로젝트가 **Paused**면 **Restore project**를 누른다(몇 분 걸린다).
   무료 플랜은 7일 동안 활동이 없으면 일시정지된다. `/api/cron/db-health`가 매일 조회해서 막고 있지만,
   cron이 멈췄거나 키가 틀리면 걸릴 수 있다.
2. Paused가 아니면 Vercel 환경변수의 URL·키가 맞는지 확인한다.
3. 복구 후 관리자 화면에서 목록이 뜨는지 본다.
4. 장애 동안 실패한 신청은 저장되지 않았다. 슬랙·메일의 "신청 저장" 경고 시각을 보고, 해당 시간에
   연락 온 손님이 있는지 확인한다.

## 백업에서 복구

1. 운영자 메일함에서 가장 최근 `[코이노니아] 주간 백업` 메일의 JSON 첨부를 내려받는다.
2. 드라이런으로 건수를 확인한다:
   ```bash
   npx tsx --env-file=.env.local scripts/restore-backup.ts ~/Downloads/koinonia-backup-YYYY-MM-DD.json --dry-run
   ```
3. 실제 복구:
   ```bash
   npx tsx --env-file=.env.local scripts/restore-backup.ts ~/Downloads/koinonia-backup-YYYY-MM-DD.json
   ```
   이미 있는 id는 건너뛰므로 여러 번 돌려도 안전하다. 백업 이후에 생긴 신청은 들어 있지 않다.

## 수기 등록 (전화·현장 예약)

Supabase 대시보드 > Table Editor > `bookings` > Insert row.
- `kind`: `salon` 또는 `stay`
- `status`: `신청` / `입금확인` / `취소`
- `created_at`은 비워도 된다(관리자 화면에 신청일시 "—"로 나온다). 비우면 예약 확인 페이지와
  D-1·체크아웃 안내 문자에서 빠진다(시트 시절과 같다).
- `id`, `phone_digits`는 비워둔다(자동).

## 시트에서 이전 (한 번만)

전환 당일 절차는 설계 문서 4장. 명령:

```bash
npx tsx --env-file=.env.local scripts/migrate-sheets-to-supabase.ts --dry-run
npx tsx --env-file=.env.local scripts/migrate-sheets-to-supabase.ts
```

스크립트는 이미 DB에 있는 행을 절대 덮어쓰지 않는다. 시트와 DB 값이 다른 행은 "어긋남"으로 출력만 한다.
````

- [ ] **Step 9: 스크립트 타입 확인**

Run: `npm run typecheck`
Expected: 통과 (`tsconfig.json`의 `include`가 `**/*.ts`라 `scripts/`도 검사된다)

- [ ] **Step 10: 커밋**

```bash
git add src/lib/backup.ts src/lib/store.ts src/app/api/cron/weekly-backup vercel.json scripts/restore-backup.ts \
  docs/runbook-supabase.md src/lib/__tests__/backup.test.ts
git commit -m "feat(ops): 주간 백업 메일 + 복구 스크립트 + Supabase 운영 가이드

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: 시트 → DB 이전 스크립트

**Files:**
- Create: `src/lib/sheet-import.ts`
- Create: `scripts/migrate-sheets-to-supabase.ts`
- Modify: `package.json` (`googleapis`를 devDependencies로)
- Test: `src/lib/__tests__/sheet-import.test.ts`

**Interfaces:**
- Consumes: `parseKstDateTime` (Task 1), `fetchAllPages`/`PageResult` (Task 2), `KIND_TAB`/`BookingKind`/`BookingRecord`/`RetreatRecord`/`OpenStayRecord` (Task 5), `isSheetTab`/`SheetTab` (Task 4), `BulkLogRecord` 타입 (Task 7), `BulkAction`/`BulkCondition`/`BulkSnapshotItem` 타입 (`bulk.ts`)
- Produces:
  - `isBlankRow(values: string[]): boolean`
  - `importBookingRow(values, kind, sheetRow): { record: BookingImport; warnings: string[] }`
  - `importRetreatRow(values, sheetRow)`, `importOpenStayRow(values, sheetRow)` — 같은 모양
  - `parseSheetBulkLogRow(values, sheetRow): SheetBulkLog | null`
  - `mapSnapshotRefs(items, idOf): { snapshot: BulkSnapshotItem[]; missing: SheetSnapshotItem[] }`
  - `bulkLogImport(log: SheetBulkLog, snapshot: BulkSnapshotItem[]): BulkLogImport`
  - `diffImported(sheetRec, dbRec, fields: readonly string[]): string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/__tests__/sheet-import.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  bulkLogImport,
  diffImported,
  importBookingRow,
  importOpenStayRow,
  importRetreatRow,
  isBlankRow,
  mapSnapshotRefs,
  parseSheetBulkLogRow,
} from "@/lib/sheet-import";

const CREATED_TEXT = "2026. 9. 6. 오후 7:10:32";
const CREATED_ISO = "2026-09-06T10:10:32.000Z";

function stayRow(over: Record<number, string> = {}): string[] {
  const r = [
    CREATED_TEXT, "스테이", "홍길동", "010-1234-5678", "", "", "옥순방", "2",
    "2026-09-20", "2026-09-22", "없음", "240000", "창가", "입금확인", "✅ 10:00 확정",
  ];
  for (const [i, v] of Object.entries(over)) r[Number(i)] = v;
  return r;
}

describe("importBookingRow", () => {
  it("열을 그대로 옮기고 신청일시는 실제 시각, 종류는 탭으로 정한다", () => {
    const { record, warnings } = importBookingRow(stayRow({ 1: "살롱?" }), "stay", 12);
    expect(record).toEqual({
      sheet_row: 12, kind: "stay", created_at: CREATED_ISO, name: "홍길동", phone: "010-1234-5678",
      program: "", date_text: "", room: "옥순방", nights: "2", check_in: "2026-09-20", check_out: "2026-09-22",
      discount: "없음", total_amount: 240000, memo: "창가", status: "입금확인", notify_status: "✅ 10:00 확정",
    });
    expect(warnings).toEqual([]);
  });

  it("금액 '150,000'·'150000원'은 숫자만", () => {
    expect(importBookingRow(stayRow({ 11: "150,000" }), "stay", 2).record.total_amount).toBe(150000);
    expect(importBookingRow(stayRow({ 11: "150000원" }), "stay", 2).record.total_amount).toBe(150000);
  });

  it("금액이 비면 null, 경고 없음", () => {
    const { record, warnings } = importBookingRow(stayRow({ 11: "" }), "stay", 2);
    expect(record.total_amount).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("숫자가 없는 금액은 null + 요청사항 끝에 원래 값을 남기고 경고", () => {
    const { record, warnings } = importBookingRow(stayRow({ 11: "무료" }), "stay", 7);
    expect(record.total_amount).toBeNull();
    expect(record.memo).toBe("창가\n[이전 전 금액: 무료]");
    expect(warnings).toEqual(["스테이 7행: 금액을 숫자로 못 읽음 \"무료\" → 요청사항에 보존"]);
  });

  it("신청일시가 비면 null (수기 입력 행), 경고 없음", () => {
    const { record, warnings } = importBookingRow(stayRow({ 0: "" }), "stay", 3);
    expect(record.created_at).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("신청일시 형식을 못 읽으면 null + 요청사항에 원래 값을 남기고 경고", () => {
    const { record, warnings } = importBookingRow(stayRow({ 0: "9/6 저녁", 12: "" }), "stay", 4);
    expect(record.created_at).toBeNull();
    expect(record.memo).toBe("[이전 전 신청일시: 9/6 저녁]");
    expect(warnings[0]).toContain("신청일시");
  });

  it("짧은 행(시트 API가 뒤쪽 빈 칸을 자름)도 빈 문자열로 채운다", () => {
    const { record } = importBookingRow(["", "살롱", "김"], "salon", 5);
    expect(record.status).toBe("");
    expect(record.notify_status).toBe("");
    expect(record.kind).toBe("salon");
  });
});

describe("리트릿·무료개방", () => {
  it("리트릿 A~M", () => {
    const v = [CREATED_TEXT, "이", "010", "고2", "안동", "1회차", "추천", "질문", "요청", "땅콩", "케어", "부모", "신청"];
    expect(importRetreatRow(v, 2).record).toEqual({
      sheet_row: 2, created_at: CREATED_ISO, name: "이", phone: "010", grade: "고2", region: "안동",
      session: "1회차", referral: "추천", question: "질문", memo: "요청", allergy: "땅콩", care: "케어",
      parent_note: "부모", status: "신청",
    });
  });

  it("무료개방 A~L, 못 읽은 신청일시는 응원메시지 칸에 보존", () => {
    const v = ["어제", "박", "010", "e", "i", "o", "혼자", "1", "r", "청소", "", "확정"];
    const { record } = importOpenStayRow(v, 9);
    expect(record.created_at).toBeNull();
    expect(record.message).toBe("[이전 전 신청일시: 어제]");
    expect(record.status).toBe("확정");
  });
});

describe("isBlankRow", () => {
  it("공백뿐이면 빈 행", () => {
    expect(isBlankRow(["", " ", ""])).toBe(true);
    expect(isBlankRow([])).toBe(true);
    expect(isBlankRow(["", "x"])).toBe(false);
  });
});

describe("일괄 처리 로그", () => {
  const row = [
    "abc123abc123", "2026-09-10 14:32:05", '{"status":"pending","type":"all"}', "confirm", "없음", "2",
    '[["살롱#2","신청",""],["스테이#12","","✅ 10:00 접수"]]', "",
  ];

  it("시트 로그 한 줄을 읽는다", () => {
    const log = parseSheetBulkLogRow(row, 4)!;
    expect(log).toMatchObject({
      sheetRow: 4, jobId: "abc123abc123", at: "2026-09-10 14:32:05", action: "confirm",
      notify: false, count: 2, reverted: "",
      filter: { status: "pending", type: "all" },
    });
    expect(log.snapshot).toEqual([
      { tab: "살롱", sheetRow: 2, status: "신청", notify: "" },
      { tab: "스테이", sheetRow: 12, status: "", notify: "✅ 10:00 접수" },
    ]);
  });

  it("헤더·빈 줄은 null", () => {
    expect(parseSheetBulkLogRow(["jobId", "시각"], 1)).toBeNull();
    expect(parseSheetBulkLogRow([], 3)).toBeNull();
  });

  it("시트 행 번호를 DB id로 바꾸고, 못 찾은 항목은 따로 모은다", () => {
    const log = parseSheetBulkLogRow(row, 4)!;
    const ids = new Map([["살롱#2", 101]]);
    const { snapshot, missing } = mapSnapshotRefs(log.snapshot, (tab, n) => ids.get(`${tab}#${n}`));
    expect(snapshot).toEqual([{ ref: { tab: "살롱", id: 101 }, status: "신청", notify: "" }]);
    expect(missing).toEqual([{ tab: "스테이", sheetRow: 12, status: "", notify: "✅ 10:00 접수" }]);
  });

  it("DB 레코드 모양으로", () => {
    const log = parseSheetBulkLogRow(row, 4)!;
    const rec = bulkLogImport(log, [{ ref: { tab: "살롱", id: 101 }, status: "신청", notify: "" }]);
    expect(rec).toEqual({
      sheet_row: 4, job_id: "abc123abc123", at: "2026-09-10 14:32:05",
      filter: { status: "pending", type: "all" }, action: "confirm", notify: false, count: 2,
      snapshot: [{ ref: { tab: "살롱", id: 101 }, status: "신청", notify: "" }], reverted_at: "",
    });
  });
});

describe("diffImported", () => {
  it("지정한 칸 중 값이 다른 칸 이름만", () => {
    expect(
      diffImported({ status: "신청", memo: "a", name: "x" }, { status: "입금확인", memo: "a", name: "y" }, ["status", "memo"])
    ).toEqual(["status"]);
  });

  it("null과 빈 문자열은 같다고 본다", () => {
    expect(diffImported({ memo: "" }, { memo: null }, ["memo"])).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/__tests__/sheet-import.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `sheet-import.ts` 작성**

`src/lib/sheet-import.ts`:

```ts
/**
 * 구글 시트 행 → DB 레코드 변환 — 순수 로직. 이전 스크립트(scripts/migrate-sheets-to-supabase.ts) 전용.
 *
 * 원칙: 데이터를 조용히 버리지 않는다. 신청일시·금액을 못 읽으면 DB 칸은 비우고
 * 원래 값을 메모 칸 끝에 남긴 뒤 경고를 낸다.
 * 시트 API는 행 뒤쪽 빈 칸을 잘라서 주므로 없는 칸은 빈 문자열로 본다.
 */

import type { BulkAction, BulkCondition, BulkSnapshotItem } from "@/lib/bulk";
import type { BulkLogRecord } from "@/lib/bulk-log";
import { parseKstDateTime } from "@/lib/kst-datetime";
import { isSheetTab, type SheetTab } from "@/lib/row-ref";
import {
  KIND_TAB,
  type BookingKind,
  type BookingRecord,
  type OpenStayRecord,
  type RetreatRecord,
} from "@/lib/store-rows";

export type BookingImport = Omit<BookingRecord, "id"> & { sheet_row: number };
export type RetreatImport = Omit<RetreatRecord, "id"> & { sheet_row: number };
export type OpenStayImport = Omit<OpenStayRecord, "id"> & { sheet_row: number };
export type BulkLogImport = Omit<BulkLogRecord, "id"> & { sheet_row: number };
export type Imported<T> = { record: T; warnings: string[] };

const cell = (v: string[], i: number) => String(v[i] ?? "").trim();
const withNote = (text: string, note: string) => (text ? `${text}\n${note}` : note);

export function isBlankRow(values: string[]): boolean {
  return values.every((v) => !String(v ?? "").trim());
}

/** 신청일시: 비면 null(수기 행, 경고 없음), 못 읽으면 null + 메모에 보존 + 경고 */
function importCreated(raw: string, where: string, warnings: string[], keep: (note: string) => void): string | null {
  if (!raw) return null;
  const d = parseKstDateTime(raw);
  if (d) return d.toISOString();
  warnings.push(`${where}: 신청일시 형식을 못 읽음 "${raw}" → 메모에 보존`);
  keep(`[이전 전 신청일시: ${raw}]`);
  return null;
}

export function importBookingRow(values: string[], kind: BookingKind, sheetRow: number): Imported<BookingImport> {
  const where = `${KIND_TAB[kind]} ${sheetRow}행`;
  const warnings: string[] = [];
  let memo = cell(values, 12);

  const created_at = importCreated(cell(values, 0), where, warnings, (n) => (memo = withNote(memo, n)));

  const rawAmount = cell(values, 11);
  let total_amount: number | null = null;
  if (rawAmount) {
    const digits = rawAmount.replace(/\D/g, "");
    if (digits) {
      total_amount = Number(digits);
    } else {
      warnings.push(`${where}: 금액을 숫자로 못 읽음 "${rawAmount}" → 요청사항에 보존`);
      memo = withNote(memo, `[이전 전 금액: ${rawAmount}]`);
    }
  }

  return {
    record: {
      sheet_row: sheetRow,
      kind,
      created_at,
      name: cell(values, 2),
      phone: cell(values, 3),
      program: cell(values, 4),
      date_text: cell(values, 5),
      room: cell(values, 6),
      nights: cell(values, 7),
      check_in: cell(values, 8),
      check_out: cell(values, 9),
      discount: cell(values, 10),
      total_amount,
      memo,
      status: cell(values, 13),
      notify_status: cell(values, 14),
    },
    warnings,
  };
}

export function importRetreatRow(values: string[], sheetRow: number): Imported<RetreatImport> {
  const warnings: string[] = [];
  let memo = cell(values, 8);
  const created_at = importCreated(cell(values, 0), `리트릿 ${sheetRow}행`, warnings, (n) => (memo = withNote(memo, n)));
  return {
    record: {
      sheet_row: sheetRow,
      created_at,
      name: cell(values, 1),
      phone: cell(values, 2),
      grade: cell(values, 3),
      region: cell(values, 4),
      session: cell(values, 5),
      referral: cell(values, 6),
      question: cell(values, 7),
      memo,
      allergy: cell(values, 9),
      care: cell(values, 10),
      parent_note: cell(values, 11),
      status: cell(values, 12),
    },
    warnings,
  };
}

export function importOpenStayRow(values: string[], sheetRow: number): Imported<OpenStayImport> {
  const warnings: string[] = [];
  let message = cell(values, 10);
  const created_at = importCreated(cell(values, 0), `무료개방 ${sheetRow}행`, warnings, (n) => (message = withNote(message, n)));
  return {
    record: {
      sheet_row: sheetRow,
      created_at,
      name: cell(values, 1),
      phone: cell(values, 2),
      email: cell(values, 3),
      check_in: cell(values, 4),
      check_out: cell(values, 5),
      group_type: cell(values, 6),
      group_size: cell(values, 7),
      reason: cell(values, 8),
      contribution: cell(values, 9),
      message,
      status: cell(values, 11),
    },
    warnings,
  };
}

/* ─── 일괄 처리 로그 (`_bulk_log` 탭) ──────────── */

export type SheetSnapshotItem = { tab: SheetTab; sheetRow: number; status: string; notify: string };

export type SheetBulkLog = {
  sheetRow: number;
  jobId: string;
  at: string;
  filter: BulkCondition;
  action: BulkAction;
  notify: boolean;
  count: number;
  snapshot: SheetSnapshotItem[];
  reverted: string;
};

/** 시트 스냅샷 `[["살롱#2","신청",""], …]`. 하나라도 이상하면 빈 배열(옛 decodeSnapshot과 같다). */
function decodeSheetSnapshot(raw: string): SheetSnapshotItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: SheetSnapshotItem[] = [];
  for (const it of parsed) {
    if (!Array.isArray(it) || typeof it[0] !== "string") return [];
    const [tab, num] = it[0].split("#");
    const sheetRow = Number(num);
    if (!isSheetTab(tab) || !Number.isInteger(sheetRow) || sheetRow < 2) return [];
    out.push({
      tab,
      sheetRow,
      status: typeof it[1] === "string" ? it[1] : "",
      notify: typeof it[2] === "string" ? it[2] : "",
    });
  }
  return out;
}

/** 열: A jobId · B 시각 · C 조건 JSON · D 동작 · E 알림(발송/없음) · F 건수 · G 스냅샷 · H 되돌림 */
export function parseSheetBulkLogRow(values: string[], sheetRow: number): SheetBulkLog | null {
  const jobId = cell(values, 0);
  if (!jobId || jobId === "jobId") return null;

  let filter: BulkCondition = { status: "all", type: "all" };
  try {
    const f = JSON.parse(cell(values, 2) || "{}");
    if (f && typeof f === "object") filter = f as BulkCondition;
  } catch {
    /* 조건을 못 읽어도 되돌리기는 스냅샷만 있으면 된다 */
  }

  return {
    sheetRow,
    jobId,
    at: cell(values, 1),
    filter,
    action: (cell(values, 3) || "confirm") as BulkAction,
    notify: cell(values, 4) === "발송",
    count: Number(cell(values, 5)) || 0,
    snapshot: decodeSheetSnapshot(cell(values, 6)),
    reverted: cell(values, 7),
  };
}

/** 스냅샷의 시트 행 번호를 DB id로. 못 찾은 항목은 missing으로 돌려준다(스크립트가 경고). */
export function mapSnapshotRefs(
  items: SheetSnapshotItem[],
  idOf: (tab: SheetTab, sheetRow: number) => number | undefined
): { snapshot: BulkSnapshotItem[]; missing: SheetSnapshotItem[] } {
  const snapshot: BulkSnapshotItem[] = [];
  const missing: SheetSnapshotItem[] = [];
  for (const it of items) {
    const id = idOf(it.tab, it.sheetRow);
    if (id === undefined) missing.push(it);
    else snapshot.push({ ref: { tab: it.tab, id }, status: it.status, notify: it.notify });
  }
  return { snapshot, missing };
}

export function bulkLogImport(log: SheetBulkLog, snapshot: BulkSnapshotItem[]): BulkLogImport {
  return {
    sheet_row: log.sheetRow,
    job_id: log.jobId,
    at: log.at,
    filter: log.filter,
    action: log.action,
    notify: log.notify,
    count: log.count,
    snapshot,
    reverted_at: log.reverted,
  };
}

/* ─── 어긋남 ───────────────────────────────────── */

/** 이미 DB에 있는 이전 행과 시트 값이 다른 칸 이름. null과 빈 문자열은 같다고 본다. */
export function diffImported(
  sheetRec: Record<string, unknown>,
  dbRec: Record<string, unknown>,
  fields: readonly string[]
): string[] {
  const norm = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return fields.filter((f) => norm(sheetRec[f]) !== norm(dbRec[f]));
}
```

주의: `sheet-import.ts`는 `bulk-log.ts`에서 **타입만** import한다(`import type`). `bulk-log.ts`의 `server-only`가 스크립트 실행 시 불려오지 않게 하려면 반드시 `import type`이어야 한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/__tests__/sheet-import.test.ts`
Expected: PASS

- [ ] **Step 5: `googleapis`를 devDependencies로**

```bash
npm uninstall googleapis && npm install -D googleapis
```

Expected: `package.json`에서 `googleapis`가 `dependencies`에서 빠지고 `devDependencies`에 들어간다.

- [ ] **Step 6: 이전 스크립트 작성**

`scripts/migrate-sheets-to-supabase.ts`:

```ts
/**
 * 구글 시트 → Supabase 이전 (설계: docs/superpowers/specs/2026-09-19-supabase-migration-design.md 3·4장)
 *
 * 사용:
 *   npx tsx --env-file=.env.local scripts/migrate-sheets-to-supabase.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/migrate-sheets-to-supabase.ts
 *
 * - 이미 DB에 있는 행(같은 sheet_row)은 **절대 덮어쓰지 않는다**. 새 행만 넣는다.
 *   그래서 배포 후 다시 돌려도 관리자가 바꾼 상태가 시트의 옛 값으로 되돌아가지 않는다.
 * - 시트와 DB 값이 다른 이전 행은 "어긋남"으로 출력만 한다(자동으로 고치지 않음).
 * - 끝에 탭별 시트 행 수와 DB 이전 행 수를 대조하고, 다르면 종료 코드 1.
 * - server-only 모듈(store/supabase/bulk-log 런타임)은 import하지 않는다.
 */

import { google } from "googleapis";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages, type PageResult } from "@/lib/paginate";
import type { SheetTab } from "@/lib/row-ref";
import {
  bulkLogImport,
  diffImported,
  importBookingRow,
  importOpenStayRow,
  importRetreatRow,
  isBlankRow,
  mapSnapshotRefs,
  parseSheetBulkLogRow,
  type Imported,
} from "@/lib/sheet-import";
import { KIND_TAB, type BookingKind } from "@/lib/store-rows";

const DRY = process.argv.includes("--dry-run");
const CHUNK = 500;

type Rec = Record<string, unknown> & { sheet_row: number };
type Sheets = ReturnType<typeof google.sheets>;

type Job = {
  label: string;
  table: "bookings" | "retreats" | "open_stays";
  range: string;
  kind?: BookingKind;
  onConflict: string;
  diffFields: readonly string[];
  build: (values: string[], sheetRow: number) => Imported<Rec>;
};

const JOBS: Job[] = [
  {
    label: "살롱", table: "bookings", range: "살롱!A:O", kind: "salon", onConflict: "kind,sheet_row",
    diffFields: ["status", "notify_status", "memo"],
    build: (v, n) => importBookingRow(v, "salon", n),
  },
  {
    label: "스테이", table: "bookings", range: "스테이!A:O", kind: "stay", onConflict: "kind,sheet_row",
    diffFields: ["status", "notify_status", "memo"],
    build: (v, n) => importBookingRow(v, "stay", n),
  },
  {
    label: "리트릿", table: "retreats", range: "리트릿!A:M", onConflict: "sheet_row",
    diffFields: ["status", "memo"],
    build: (v, n) => importRetreatRow(v, n),
  },
  {
    label: "무료개방", table: "open_stays", range: "무료개방!A:L", onConflict: "sheet_row",
    diffFields: ["status"],
    build: (v, n) => importOpenStayRow(v, n),
  },
];

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`환경변수 ${name}이(가) 없습니다. --env-file=.env.local 을 붙였는지 확인하세요.`);
    process.exit(2);
  }
  return v;
}

/** 탭 읽기. 탭이 없을 때만 빈 배열, 그 밖의 오류는 던진다. */
async function readTab(sheets: Sheets, spreadsheetId: string, range: string): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return (res.data.values as string[][] | null) ?? [];
  } catch (e) {
    if (/Unable to parse range/i.test(String((e as Error)?.message ?? e))) return [];
    throw e;
  }
}

/** DB에 이미 있는 이전 행(sheet_row가 있는 행) 전부 */
function migrated(db: SupabaseClient, table: string, kind?: BookingKind): Promise<Rec[]> {
  return fetchAllPages<Rec>((from, to) => {
    const base = db.from(table).select("*").not("sheet_row", "is", null);
    const q = kind ? base.eq("kind", kind) : base;
    return q.order("id", { ascending: true }).range(from, to) as unknown as PromiseLike<PageResult<Rec>>;
  });
}

async function insertNew(db: SupabaseClient, table: string, rows: Rec[], onConflict: string) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    // ignoreDuplicates: 이미 있는 행은 건드리지 않는다(덮어쓰기 금지)
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict, ignoreDuplicates: true });
    if (error) throw error;
  }
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(env("GOOGLE_SERVICE_ACCOUNT_JSON")),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = env("GOOGLE_SHEET_ID");
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(DRY ? "── 드라이런: 아무것도 쓰지 않습니다 ──\n" : "── 이전 시작 ──\n");

  const legacy = await readTab(sheets, sheetId, "신청내역!A:A");
  if (legacy.length > 1) {
    console.warn(`⚠ 옛 탭 '신청내역'에 ${legacy.length - 1}행이 있습니다. 앱이 읽지 않던 탭이라 옮기지 않습니다.\n`);
  }

  const summary: { 탭: string; 시트행: number; 새로넣을행: number; DB이전행: number; 어긋남: number }[] = [];
  let mismatch = false;

  for (const job of JOBS) {
    const values = await readTab(sheets, sheetId, job.range);
    const prepared: Rec[] = [];
    const warnings: string[] = [];
    for (let i = 1; i < values.length; i++) {
      const v = values[i] ?? [];
      if (isBlankRow(v)) continue;
      const { record, warnings: w } = job.build(v, i + 1);
      prepared.push(record);
      warnings.push(...w);
    }

    const before = await migrated(db, job.table, job.kind);
    const bySheetRow = new Map(before.map((r) => [r.sheet_row, r]));
    const fresh = prepared.filter((r) => !bySheetRow.has(r.sheet_row));
    const drift: string[] = [];
    for (const r of prepared) {
      const existing = bySheetRow.get(r.sheet_row);
      if (!existing) continue;
      const fields = diffImported(r, existing, job.diffFields);
      if (fields.length) drift.push(`${job.label} ${r.sheet_row}행 (DB id ${existing.id}): ${fields.join(", ")}`);
    }

    for (const w of warnings) console.warn(`⚠ ${w}`);
    for (const d of drift) console.warn(`≠ 어긋남 ${d}`);

    if (!DRY) await insertNew(db, job.table, fresh, job.onConflict);
    const after = DRY ? before.length + fresh.length : (await migrated(db, job.table, job.kind)).length;

    summary.push({ 탭: job.label, 시트행: prepared.length, 새로넣을행: fresh.length, DB이전행: after, 어긋남: drift.length });
    if (!DRY && after !== prepared.length) mismatch = true;
  }

  /* ── 일괄 처리 로그: 스냅샷의 시트 행 번호를 DB id로 바꿔 옮긴다 ── */
  const logRows = await readTab(sheets, sheetId, "'_bulk_log'!A:H");
  const logs = logRows.map((v, i) => parseSheetBulkLogRow(v ?? [], i + 1)).filter((l) => l !== null);

  if (DRY) {
    summary.push({ 탭: "_bulk_log", 시트행: logs.length, 새로넣을행: logs.length, DB이전행: 0, 어긋남: 0 });
    console.log("\n(드라이런) 일괄 처리 로그는 예약을 옮긴 뒤에만 id를 맞출 수 있어 건수만 셉니다.");
  } else {
    const bookingIds = new Map<string, number>();
    for (const kind of ["salon", "stay"] as const) {
      for (const r of await migrated(db, "bookings", kind)) {
        bookingIds.set(`${KIND_TAB[kind]}#${r.sheet_row}`, Number(r.id));
      }
    }
    const idOf = (tab: SheetTab, sheetRow: number) => bookingIds.get(`${tab}#${sheetRow}`);

    const records: Rec[] = [];
    for (const log of logs) {
      const { snapshot, missing } = mapSnapshotRefs(log.snapshot, idOf);
      for (const m of missing) {
        console.warn(`⚠ _bulk_log ${log.sheetRow}행: 스냅샷 ${m.tab}#${m.sheetRow}에 해당하는 예약이 없어 제외`);
      }
      records.push(bulkLogImport(log, snapshot) as unknown as Rec);
    }

    const beforeLogs = await fetchAllPages<Rec>((from, to) =>
      db.from("bulk_logs").select("*").not("sheet_row", "is", null).order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<PageResult<Rec>>
    );
    const seen = new Set(beforeLogs.map((r) => r.sheet_row));
    const freshLogs = records.filter((r) => !seen.has(r.sheet_row));
    const logDrift = records.filter((r) => {
      const ex = beforeLogs.find((b) => b.sheet_row === r.sheet_row);
      return ex && diffImported(r, ex, ["reverted_at"]).length > 0;
    });
    for (const r of logDrift) console.warn(`≠ 어긋남 _bulk_log ${r.sheet_row}행: reverted_at`);

    await insertNew(db, "bulk_logs", freshLogs, "sheet_row");
    const afterLogs = beforeLogs.length + freshLogs.length;
    summary.push({ 탭: "_bulk_log", 시트행: records.length, 새로넣을행: freshLogs.length, DB이전행: afterLogs, 어긋남: logDrift.length });
    if (afterLogs !== records.length) mismatch = true;
  }

  console.log("");
  console.table(summary);

  if (mismatch) {
    console.error("\n✗ 시트 행 수와 DB 이전 행 수가 다릅니다. 위 경고를 확인하세요.");
    process.exit(1);
  }
  console.log(DRY ? "\n✓ 드라이런 끝." : "\n✓ 이전 끝. 건수가 모두 맞습니다.");
}

main().catch((e) => {
  console.error("✗ 이전 실패:", e);
  process.exit(1);
});
```

- [ ] **Step 7: 타입·전체 테스트 확인**

Run: `npm run typecheck && npm test`
Expected: 통과

- [ ] **Step 8: 커밋**

```bash
git add src/lib/sheet-import.ts src/lib/__tests__/sheet-import.test.ts scripts/migrate-sheets-to-supabase.ts package.json package-lock.json
git commit -m "feat(migrate): 시트 → Supabase 이전 스크립트 (덮어쓰기 없음, 어긋남 보고, 건수 대조)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: 정리와 전체 검증

**Files:**
- Delete: `google-apps-script/`
- Modify: `.env.example` (구글 시트 블록 설명)
- Modify: `docs/admin-ux-design.md` (6.1절에 한 줄)

- [ ] **Step 1: Apps Script 삭제**

```bash
git rm -r google-apps-script
```

아침 리포트는 Vercel cron `/api/cron/morning-digest`가 보낸다. 실제 트리거 해제(`removeTriggers`)는 전환 당일 6단계에서 시트 쪽에서 한다.

- [ ] **Step 2: `.env.example` 구글 시트 블록 설명 바꾸기**

`# ─── 구글 시트 ───` 블록을 아래로 교체한다:

```
# ─── 구글 시트 (이전 스크립트 전용) ────────────────
# 2026-09-19부터 앱은 시트를 읽지 않는다. scripts/migrate-sheets-to-supabase.ts만 쓴다.
# 전환이 끝나면 Vercel 환경변수에서는 지워도 된다.
GOOGLE_SHEET_ID=
# 서비스 계정 JSON 전체를 한 줄로 (개행 없이)
GOOGLE_SERVICE_ACCOUNT_JSON=
```

- [ ] **Step 3: 설계 문서에 메모 추가**

`docs/admin-ux-design.md`의 `### 6.1 행 식별을 시트 행 번호로 (Max)` 제목 바로 아래 줄에 추가:

```markdown
> 2026-09-19 Supabase 이전으로 `{ tab, rowNum }`은 `{ tab, id }`(DB 기본키)로 바뀌었다. meta의 헤더 자리는 `id: 0`. 설계: `docs/superpowers/specs/2026-09-19-supabase-migration-design.md`
```

- [ ] **Step 4: 남은 시트 흔적 검색**

```bash
grep -rn -e "rowNum" -e "batchUpdateCells" -e "refCellRange" -e "@/lib/sheets" -e "GOOGLE_SHEET_ID" src || echo "clean"
```

Expected: `clean`. 남아 있으면 해당 규칙(Task 4·8)대로 고친다.

- [ ] **Step 5: 브라우저 번들에 service role 키가 안 들어가는지 확인**

```bash
grep -rln -e "@/lib/store" -e "@/lib/supabase" -e "@/lib/bulk-log" src/app src/components | xargs grep -l '"use client"' || echo "no client imports"
```

Expected: `no client imports`

- [ ] **Step 6: 전체 검증**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: 넷 다 통과. `npm run build`는 환경변수 없이도 성공해야 한다(`getDb()`가 null을 돌려주는 경로).

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: Apps Script 은퇴, 시트 환경변수를 이전 스크립트 전용으로 표시

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: 실제 Supabase로 확인 (사용자 협조 필요)

이 Task는 실제 키가 있어야 한다. 사용자에게 `.env.local`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 넣어 달라고 요청한다. 아래 결과를 그대로 보고한다.

- [ ] **Step 1: 스키마 적용**

사용자에게 `supabase/migrations/0001_init.sql` 전체를 Supabase SQL Editor에 붙여넣고 Run 해 달라고 요청한다.

- [ ] **Step 2: anon 키로는 접근이 막히는지 확인**

사용자에게 대시보드 > Project Settings > API의 anon(publishable) 키를 받아 실행한다:

```bash
curl -s "$SUPABASE_URL/rest/v1/bookings?select=id&limit=1" -H "apikey: <anon 키>" -H "Authorization: Bearer <anon 키>"
```

Expected: `[]` 또는 권한 오류(`permission denied`). **행이 보이면 즉시 중단하고 보고한다.**

- [ ] **Step 3: 트랜잭션 확인 — 없는 id가 섞이면 하나도 안 바뀌는지**

`scripts/` 밖, 스크래치 디렉터리에 임시 스크립트를 만들어 실행한다:

```ts
// $SCRATCH/tx-check.ts — npx tsx --env-file=.env.local $SCRATCH/tx-check.ts
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: row } = await db.from("bookings").insert({ kind: "salon", name: "TX테스트", status: "신청" }).select("id").single();
const { error } = await db.rpc("apply_booking_patches", { patches: [{ id: row!.id, status: "입금확인" }, { id: 999999999, status: "x" }] });
const { data: after } = await db.from("bookings").select("status").eq("id", row!.id).single();
console.log({ rpcError: error?.message, statusAfter: after!.status });
await db.from("bookings").delete().eq("id", row!.id);
```

Expected: `rpcError`에 `not found`, `statusAfter: "신청"` (롤백됨)

- [ ] **Step 4: 이전 드라이런**

Run: `npx tsx --env-file=.env.local scripts/migrate-sheets-to-supabase.ts --dry-run`
Expected: 탭별 시트 행 수 표. 경고(신청일시·금액)가 있으면 목록을 사용자에게 보여준다. **실제 이전은 전환 당일 절차(설계 4장)대로 사용자와 함께 한다 — 여기서 실행하지 않는다.**

- [ ] **Step 5: 로컬 흐름 확인 (빈 DB 또는 테스트 데이터로)**

`npm run dev` 후:
1. `/salon`에서 신청 → Supabase `bookings`에 행이 생기고 `created_at`이 KST 기준 맞는 시각인지, `notify_status`가 채워졌는지
2. `/admin` 목록에 보이는지 → 입금확인 → 상태 바뀌는지
3. 일괄 처리 미리보기 → 실행 → `bulk_logs`에 기록 → 되돌리기
4. `/booking-check`에서 연락처로 조회
5. `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/db-health` → `{"ok":true,...}`

각 단계 결과를 사용자에게 보고한다. 확인이 끝나면 테스트 데이터를 지운다(`delete from bookings where name like 'TX%' or ...` — 지우기 전에 대상 행을 사용자에게 보여준다).

---

## Self-Review 결과

- **스펙 대비 누락 확인**: 스키마·RLS(T3), 1,000행(T2·T6), `RowRef` id(T4), 패치·트랜잭션(T3·T4·T6·T8), 신청 ref 전달(T6·T8), 비파괴 이전·어긋남 보고(T11), 일시정지 방지·경고(T9), 주간 백업·복구(T10), 7장 보완 1~5(T1, T8 Step 7, T8 Step 6, T5·T2, T3), Apps Script 은퇴·정리(T12), 실제 DB 검증(T13) — 모두 대응됨.
- **이름 일관성**: `BookingPatch`(row-ref.ts)를 bulk.ts·store-rows.ts·store.ts·bulk 라우트가 같은 이름으로 쓴다. `BulkLogEntry.id`(T7) ↔ revert 라우트 `entry.id`(T8). `kstTimestamp`는 kst-datetime.ts에 있고 bulk-log.ts가 re-export(T7), backup.ts는 kst-datetime.ts에서 직접 import(T10).
- **알려진 판단**: `pickByCreatedAtThenLatest`는 연락처가 비면 호출되지 않는다(시트 시절에는 빈 연락처끼리 매칭될 수 있었다 — 수기 행을 잘못 잡는 위험을 없앤 의도적 변경, ref 경로가 수기 행을 처리한다).
