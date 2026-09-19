# 구글 시트 → Supabase 완전 이전 설계

작성일: 2026-09-19

## 목표와 범위

예약 데이터의 단일 진실 원천을 구글 시트에서 Supabase(Postgres)로 옮긴다.

- **Supabase가 원본**이다. 이전 후 구글 시트는 보관용(수정 금지)으로만 남긴다.
- 동작은 이전 전과 **똑같아야 한다.** 신청, 관리자 목록·상태 변경·재발송, 일괄 처리와 되돌리기, 예약 확인, cron(아침 리포트, 체크인 전날, 체크아웃)이 모두 대상이다.
- 수기 등록(전화·현장 예약)은 이번 범위에서 **Supabase 대시보드 Table Editor**로 한다. 관리자 수동 등록 화면은 다음 단계에서 만든다.
- Apps Script(`google-apps-script/Code.gs`)는 은퇴한다. 아침 리포트는 이미 Vercel cron `/api/cron/morning-digest`가 보낸다.

### 범위 밖 (B단계)
- `string[][]` 행 모양을 없애고 호출부를 타입 객체(`Booking` 등)로 바꾸는 리팩터링
- `check_in`, `date_text` 같은 날짜성 텍스트 필드를 `date`/`timestamptz` 타입으로 전환
- 관리자 수동 등록 폼

## 접근: 어댑터 방식

지금은 시트에서 읽은 `string[][]`를 `digest`, `stats`, `list-filter`, `bulk`, 관리자 UI(`row[12]` 같은 인덱스 접근)가 그대로 소비한다. 이 소비자들은 건드리지 않는다.

- Supabase 쪽은 타입이 있는 테이블로 설계한다.
- `src/lib/store.ts`가 `src/lib/sheets.ts`를 대체한다. **내보내는 함수 이름과 반환 모양은 유지**하고 내부만 Supabase 쿼리로 바꾼다.
- 저장소 교체와 모양 개선을 한 번에 섞지 않는다. 이번 단계는 기존 테스트로 "동작이 같다"를 증명한다.

## 1. 스키마

파일: `supabase/migrations/0001_init.sql` (Supabase SQL Editor에 붙여넣거나 `supabase db push`로 적용)

모든 테이블 공통 (`bulk_logs`는 `id`만 해당):
- `id bigint generated always as identity primary key`
- `sheet_row integer` — 이전해 온 행의 원래 시트 행 번호. 새로 생긴 행은 `null`. 이전 스크립트를 여러 번 돌려도 중복 없이 이어 넣는 키다. `retreats`·`open_stays`는 `unique (sheet_row)`, `bookings`는 살롱·스테이 두 탭이 합쳐지므로 `unique (kind, sheet_row)`다. (`bulk_logs`는 `sheet_row` 대신 `job_id`가 키다.)
- `created_at timestamptz` — **nullable**. 수기 입력 행은 신청일시가 비어 있다.
- `status text not null default '신청'`

### `bookings` (살롱 + 스테이)

| 컬럼 | 타입 | 시트 열 |
|---|---|---|
| `kind` | `text not null check (kind in ('salon','stay'))` | B 구분 |
| `created_at` | `timestamptz` | A 신청일시 |
| `name` | `text not null default ''` | C |
| `phone` | `text not null default ''` | D |
| `program` | `text not null default ''` | E |
| `date_text` | `text not null default ''` | F 일시 |
| `room` | `text not null default ''` | G |
| `nights` | `text not null default ''` | H |
| `check_in` | `text not null default ''` | I |
| `check_out` | `text not null default ''` | J |
| `discount` | `text not null default ''` | K (표시 문자열 그대로, 예: `멤버십 곁 (-20%)`) |
| `total_amount` | `integer` (nullable) | L |
| `memo` | `text not null default ''` | M |
| `status` | `text not null default '신청'` | N |
| `notify_status` | `text not null default ''` | O |

인덱스: `(kind, created_at desc)`, `phone`

### `retreats` (리트릿)

`created_at`, `name`, `phone`, `grade`, `region`, `session`(회차 **라벨** 문자열, 시트와 동일), `referral`, `question`, `memo`, `allergy`, `care`, `parent_note`, `status`. 순서는 시트 A~M 열과 같다. 텍스트 컬럼은 모두 `text not null default ''`.

### `open_stays` (무료개방)

`created_at`, `name`, `phone`, `email`, `check_in`, `check_out`, `group_type`, `group_size`, `reason`, `contribution`, `message`, `status`. 순서는 시트 A~L 열과 같다.

### `bulk_logs` (`_bulk_log`)

| 컬럼 | 타입 |
|---|---|
| `job_id` | `text not null` |
| `at` | `text not null` (KST `YYYY-MM-DD HH:mm:ss`, 기존 형식 유지) |
| `filter` | `jsonb not null` |
| `action` | `text not null` |
| `notify` | `boolean not null` |
| `count` | `integer not null` |
| `snapshot` | `jsonb not null` — `[{ ref: {tab, id}, status, notify }]` |
| `reverted_at` | `text not null default ''` |

### 보안 (RLS)

- 네 테이블 모두 `enable row level security`로 켜고 **정책은 만들지 않는다.** anon/publishable 키로는 읽기·쓰기가 모두 거부된다.
- 앱은 서버(API 라우트, cron)에서만 service role 키로 접근한다. 브라우저 → 우리 API → 저장소 흐름은 지금과 같다.

## 2. 코드 구조

### `src/lib/supabase.ts`
- `import "server-only"`로 클라이언트 번들 유입을 막는다.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`로 `@supabase/supabase-js` 클라이언트를 만든다(`auth: { persistSession: false }`).
- 환경변수가 없으면 `null`을 반환한다. 지금 `sheets.ts`처럼 "미설정이면 경고 후 건너뜀/빈 결과" 동작을 유지하기 위해서다.

### `src/lib/store.ts` (`sheets.ts` 대체)

`sheets.ts`에서 호출부가 쓰는 함수를 같은 이름·시그니처로 제공한다.

- 쓰기: `appendBooking`, `appendRetreat`, `appendOpenStay`
- 읽기: `getAllBookings(WithMeta)`, `getAllRetreats(WithMeta)`, `getAllOpenStays(WithMeta)`, `getRetreatCounts`, `getBookingsByPhone`, `getBookingRow`
- 갱신: `updateBookingStatus`, `updateNotifyStatus`, `appendBookingMemo`, `updateRetreatStatus`, `updateOpenStayStatus`
- 일괄 처리: `applyPatches(patches)` (아래 참고)

변환 규칙 (DB 행 → `string[]`):
- 열 순서는 시트와 똑같다. `bookings`는 A~O(15열), `retreats`는 A~M, `open_stays`는 A~L.
- 반환 `rows[0]`은 기존과 같은 **헤더 행**이다. `meta[0]`은 헤더 자리를 채우는 `{ tab, id: 0 }`이다(`meta`는 `rows`와 길이·순서가 같다는 기존 계약을 지킨다).
- `created_at`은 `toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })`로 포맷한다. 새 신청이 지금 쓰는 형식과 같아서 `parseSheetDateTime`이 그대로 읽는다. `null`이면 `""`.
- `kind`는 `살롱`/`스테이`로, `total_amount`는 숫자 문자열로(`null`이면 `""`) 바꾼다.
- 정렬: 지금 시트는 추가된 순서다. `bookings`는 살롱 전체 뒤에 스테이 전체(기존 `mergeBookingRowsWithMeta`와 같은 순서), 각 탭 안에서는 `id` 오름차순으로 돌려준다.

변환 규칙 (입력 → DB 행):
- `appendBooking`의 `createdAt`(ko-KR 문자열)은 `parseSheetDateTime`으로 `Date`를 만들어 저장한다. 호출부가 넘기는 문자열은 바꾸지 않는다.
- 할인 코드(`geot`/`nagnae`) → 표시 문자열 변환은 기존 로직을 그대로 옮긴다.

행 찾기:
- `ref`가 있으면 `id`로 바로 찾는다.
- 없으면 기존과 같은 순서로 탐색한다. ① 신청일시(포맷된 문자열) + 연락처(숫자만) 정확 매칭, ② 연락처만으로 최신 행. 연락처로 후보를 좁힌 뒤 앱에서 비교한다.
- DB 오류는 "행 없음"으로 위장하지 않고 그대로 던진다(기존 `readRowByRef` 원칙, 2026-09-10 사례).

### `RowRef` 변경

- `src/lib/row-ref.ts`: `RowRef = { tab: SheetTab; id: number }`. `normalizeRowRef`는 `id`가 1 이상 정수인지 검사한다.
- 시트 전용 함수 `refRowRange`, `refCellRange`, `TAB_LAST_COL`, `attachRowMeta`, `mergeBookingRowsWithMeta`는 삭제한다(필요한 조립은 `store.ts`로).
- 영향 파일: `bulk.ts`, `bulk-log.ts`, `app/admin/_components/shared.ts`, `app/admin/_components/BulkPanel.tsx`, `app/admin/preview/page.tsx`, `api/admin/bulk/route.ts`, `api/admin/bulk/revert/route.ts`, `api/admin/status/route.ts`, `api/admin/resend/route.ts`, `api/admin/bookings/route.ts`(주석).
- 헤더 행 판정 `ref.rowNum < 2`는 `ref.id < 1`로 바꾼다.
- 표시 문구 `스테이 12행`은 `스테이 #12`로 바꾼다.

### 일괄 처리

- `bulk.ts`의 `BulkPlan.writes`(A1 범위)를 `patches: { ref: RowRef; status?: string; notify?: string }[]`로 바꾼다. 대상 계산, 스냅샷, 스킵 사유 로직은 그대로다. `planRevertWrites`도 같은 패치 형식을 반환한다.
- `store.applyPatches(patches)`: 패치마다 `bookings`를 `id`로 update한다. 대상은 최대 500건(`MAX_BULK_TARGETS`)이므로 동시성 제한을 둔 병렬 update로 충분하다. 반환값은 갱신된 행 수다.
- `bulk-log.ts`는 `bulk_logs` 테이블을 쓴다. `appendBulkLog`는 insert, `findBulkLog(jobId)`는 select, `markBulkLogReverted(id, at)`는 update다. run은 지금처럼 **update 전에** 로그를 남긴다.
- 스냅샷 직렬화 `"스테이#12"` 문자열 포맷은 없애고 jsonb 객체 배열로 저장한다.

### 정리

- 삭제: `src/lib/sheets.ts`, `googleapis` 의존성, `google-apps-script/`, `initSheetHeaders`, `a1Tab`, `ensureSheetTab`, `appendSheetRow`, `readSheetRange`, `batchUpdateCells`, `isMissingRangeError`
- 단, 이전 스크립트가 시트를 읽어야 하므로 `googleapis`는 **devDependencies로 옮기고** 스크립트에서만 쓴다. 전환 완료 후 별도 커밋으로 제거한다.
- `.env.example`: `GOOGLE_*` 항목을 "이전 스크립트 전용"으로 표시하고 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 추가한다.
- 문서 `docs/admin-ux-design.md`의 시트 행 번호 설명에 "Supabase 이전 후 `{tab, id}`로 대체됨" 한 줄을 덧붙인다.

## 3. 데이터 이전

### 스크립트 `scripts/migrate-sheets-to-supabase.ts`

- 실행: `npx tsx scripts/migrate-sheets-to-supabase.ts [--dry-run]` (`.env.local`의 `GOOGLE_*`, `SUPABASE_*` 사용)
- 순서: 살롱 → 스테이 → 리트릿 → 무료개방 → `_bulk_log`
- 각 행을 변환해 `sheet_row` 기준 upsert한다(여러 번 돌려도 안전). 완전히 빈 행은 건너뛴다.
- `--dry-run`: 쓰지 않고 탭별 읽은 행 수, 변환 경고를 출력한다.
- 끝나면 탭별 **시트 행 수 / DB 행 수**를 표로 출력하고, 다르면 종료 코드 1로 끝낸다.

변환 규칙 (순수 함수 `src/lib/sheet-import.ts`로 분리, 테스트 대상):
- 신청일시: `parseSheetDateTime`으로 읽는다. 비었거나 못 읽으면 `null`이고 경고를 출력한다.
- 결제금액: 숫자만 남겨 정수로 바꾼다(`"150,000"` → `150000`). 비면 `null`. 숫자가 없는 값이면 `null`로 두고 원래 값을 `memo` 끝에 `[이전 전 금액: …]`로 덧붙이고 경고를 출력한다.
- 구분: 탭 이름으로 `kind`를 정한다(B열 값은 참고하지 않는다).
- 나머지 텍스트는 앞뒤 공백만 정리해 그대로 옮긴다.
- `_bulk_log` 스냅샷: `"스테이#12"`를 `(kind, sheet_row) → id` 매핑으로 `{ tab: "스테이", id }`로 바꾼다. 매핑이 없는 항목은 경고 후 제외한다. 그래서 이전 전에 실행한 일괄 처리도 이전 후 되돌릴 수 있다.
- `_bulk_log`의 upsert 키는 `job_id`다(`unique`).

## 4. 전환 절차

1. Supabase에 `0001_init.sql` 적용
2. `--dry-run`으로 경고 확인 → 실제 이전 → 건수 대조 통과 확인
3. Vercel 환경변수에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 추가(Production, Preview) → Supabase 버전 배포
4. 배포 직후 스크립트를 한 번 더 실행: 2~3 사이에 시트로 들어온 신규 신청만 추가로 옮겨진다
5. 관리자 화면에서 탭별 건수·최근 신청 확인
6. 시트 파일 이름에 `[보관-수정금지]`를 붙이고 Apps Script 트리거를 해제한다(`removeTriggers`)

되돌리기: 이전 커밋으로 재배포한다. 시트는 지우지 않는다. 4~5 사이에 Supabase에만 들어간 신규 건은 시트로 옮겨 적는다.

## 5. 테스트

- 기존 순수 로직 테스트(`digest`, `stats`, `list-filter`, `bulk`, `past-booking`, `messaging`, `notify` 등)는 **기대값을 바꾸지 않는다.** `RowRef` 필드명(`rowNum` → `id`)과 `bulk`의 패치 형식만 반영한다.
- `sheets.test.ts`는 `store.test.ts`로 대체한다. 가짜 Supabase 클라이언트를 주입해 다음을 검증한다.
  - DB 행 → `string[]` 열 순서, 헤더 행, `meta` 길이·순서
  - `created_at` 포맷과 `null` 처리, `total_amount` `null` 처리
  - ref 우선 찾기, 신청일시+연락처 → 연락처 순 대체 탐색
  - `applyPatches` 반영, DB 오류 전파
- `sheet-import.test.ts`: 빈 신청일시, `"150,000"`, 숫자 없는 금액, 빈 행, 스냅샷 ref 매핑과 매핑 누락
- 실제 검증: 로컬에서 실제 Supabase로 살롱 신청 → 관리자 입금확인 → 일괄 처리 → 되돌리기 → 예약 확인 페이지를 한 번 돌린다.
- 완료 조건: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` 모두 통과
