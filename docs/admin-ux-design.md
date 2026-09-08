# 어드민 UX 재설계 (①+②+③ 전부)

작성 2026-09-07 · 근거: `phases/admin-ux/esther-proposal.md` · 브랜치 `feat/admin-ux` · **로컬 확인 후 배포**

## 0. 원칙

- 운영자(호스트 1~2명, 비개발자, 휴대폰·노트북)가 **로그인 직후 오늘 할 일을 보고, 그 화면에서 처리까지 끝낸다.**
- 모바일 우선. **글자가 세로로 깨지는 곳 0** — 표 셀·배지·버튼·헤더 전부 `whitespace-nowrap`, 표는 `overflow-x-auto` 컨테이너 안에서만 가로 스크롤, 좁은 화면은 표 대신 카드.
- 파괴적 액션(취소)은 확인 단계 + 되돌리기.
- 디자인 토큰 사용: `globals.css` `@theme`의 `orange / orange-dark / teal / teal-dark / brown / cream / pink / sky` 유틸(`bg-orange`, `text-brown` …). 어드민 신규 코드에 헥사 하드코딩 금지.
- 접근성: 탭 `role=tablist/tab` + `aria-selected`, 필터 `aria-pressed`, 에러 `role=alert`, 상태 메시지 `aria-live=polite`, 버튼 최소 44px, 본문 대비 4.5:1(`text-gray-500` 이상), `focus-visible` 링(전역 규칙 있음).

## 1. 정보 구조

탭 7개 → **6개** (통계 탭 폐기, 핵심 숫자는 오늘 탭 하단으로).

```
헤더: 코이노니아 어드민 · 2026-09-07 (일) · [↻ 새로고침] [로그아웃]
탭:   오늘 | 목록 | 스테이 캘린더 | 리트릿 | 무료개방 | 설정
```

기본 탭 = **오늘**. 공개 사이트 Nav/Footer는 `/admin`에서 렌더하지 않는다.

### 오늘 탭
```
[경고 배너] 입금대기 3건 · 가장 오래된 건 2일 경과 → (없으면 "오늘 처리할 입금이 없어요")
[경고 배너] 에어비앤비 이중예약 주의: 9/12 옥순방 (캘린더 both인 날이 있을 때만)
[요약 카드 4개 · 클릭 시 해당 섹션으로 스크롤] 입금대기 N | 오늘 체크인 N | 오늘 체크아웃 N | 오늘 살롱 N
■ 입금대기 (오래된 순) — 각 행에 [입금확인] [취소]
■ 오늘 체크인 / ■ 오늘 체크아웃 / ■ 오늘 살롱 / ■ 어제 신규 신청
■ 이번 달 숫자: 확정 건수 · 확정 금액 (입금확인+결제완료, 취소 제외) — 통계 탭 대체
```

### 목록 탭
- 기본 정렬 신청일시 **내림차순**. 필터: 구분(전체/살롱/스테이) · 상태(전체/입금대기/확정/취소) · 기간 · 검색(디바운스 200ms, "N건" 표시).
- `md` 미만: **카드**. 이름+상태 배지 / 구분·프로그램(객실) / 일시(체크인~아웃) / 금액 / 연락처(`tel:` 링크) / 알림 상태 / 버튼 [입금확인] [더보기 ⌄ → 취소·재발송·요청사항 전문].
- `md` 이상: 표. 열 7개: 이름(sticky left) · 구분 · 내용 · 일시 · 금액 · 상태 · 처리. 나머지(연락처·요청사항·알림·신청일시)는 **행 클릭 → 우측 drawer**.
- 상태 배지: 신청/빈값 → 노랑 "입금대기", 입금확인·결제완료 → 초록 "확정"(결제완료는 "카드"), 취소 → 회색.
- 알림 열: `✅…` 초록 / `❌…` 빨강 + [재발송] / `⏭…` 회색 "건너뜀(템플릿 미설정)" 재발송 버튼 없음 / 빈값 "미발송" + [재발송]. 취소 행도 그대로 표시.

### 스테이 캘린더 탭
- 기존 유지 + `normalizeDate` 적용(B4) + 날짜 칸 `aria-label`("9/6 · 웹사이트 예약 · 김민지") + 지난 날짜 흐리게 + 색 외 마커(점) (C5).

### 리트릿 / 무료개방 탭
- 카운트에서 취소 제외(C4). 회차 라벨은 상수 파일 `src/lib/retreat-sessions.ts`로.
- 상태 폴백 버그 수정(`row[12] || row[9]` → row[12]만).
- 행마다 [입금확인]/[확정] [취소] [되돌리기] 버튼 (C3). "구글 시트에서 직접" 문구 삭제.

### 설정 탭 (B5)
- 알림 설정 상태 체크리스트(GET `/api/admin/notify-test`로 발송 없이 점검, 탭 진입 시 자동).
- [테스트 문자 보내기] — "호스트 번호 010-****-1234로 실제 문자 1건 발송" 설명 + 확인 단계 → POST.

### 로그인
- `sessionStorage`에 비밀번호 보관(탭 닫으면 소멸), `<label>` + `autocomplete="current-password"`, 로그아웃 버튼이 지움. 401이면 로그인 화면으로 복귀 + 배너.

### 확인 다이얼로그 (취소)
```
예약을 취소할까요?
김민지 · 살롱 프라이데이나잇 · 9/12 19:00 · 30,000원
사유: (게스트 요청 / 입금 없음 / 중복 / 기타)  ← 선택, M열(요청사항)에 "[취소사유] …" append
게스트에게 취소 알림톡이 즉시 발송됩니다. 되돌리기는 목록의 [되돌리기]로 가능합니다.
[그만두기] [취소 처리]
```

## 2. 계약 (Max ↔ Esther)

### `src/lib/digest.ts` (Max, 순수 함수 · 테스트)
```ts
export function normalizeDate(s: string): string;            // "2026. 9. 6." | "2026-09-06" | "2026/9/6" → "2026-09-06"
export function parseSheetDateTime(s: string): Date | null;  // "2026. 9. 6. 오후 7:10:32" → Date (KST)
export function kstToday(offsetDays?: number): string;       // "YYYY-MM-DD"
export type Digest = {
  today: string;
  pending: string[][];      // 살롱+스테이, 상태 ∈ {"", "신청"}, 오래된 순(신청일시 오름차순)
  checkIns: string[][];     // 스테이, normalizeDate(I열)==today, 취소 제외
  checkOuts: string[][];    // 스테이, normalizeDate(J열)==today, 취소 제외
  salonToday: string[][];   // 살롱, F열(일시)에서 날짜 추출==today, 취소 제외
  newYesterday: string[][]; // 신청일시 날짜==어제, 취소 제외
  month: { confirmedCount: number; confirmedAmount: number }; // 이번 달 신청 중 입금확인·결제완료
  retreatCounts: Record<string, number>; // 회차별, 취소 제외
};
export function buildDigest(bookings: string[][], retreats: string[][], now?: Date): Digest; // 헤더 행 포함 배열 받아 내부에서 slice(1)
export function isConfirmed(status: string): boolean;   // 입금확인 | 결제완료 | 확정
export function isPending(status: string): boolean;     // "" | 신청
export function ageDays(createdAt: string, now?: Date): number;
```
- `src/app/api/cron/morning-digest/route.ts`는 `buildDigest`를 쓰도록 교체(로직 중복 제거). 리트릿 신규 신청(메일의 "썸머캠프 신규 신청" 줄)만 `Digest`에 없어 크론이 따로 센다.
- 구현하며 확정한 것 3가지:
  1. `normalizeDate`가 `-` 구분자도 받는다 → `"2026-09-10 19:00"` → `"2026-09-10"`. (기존 크론 정규식은 `.`·공백만 받아서 이런 값을 통과시키지 못했다.)
  2. `salonToday`는 F열이 연도 없는 라벨(`"9월 12일 (토) 20:00"` — 살롱 폼이 넣는 실제 형식)이면 `now`의 연도를 붙여 비교한다. 여러 날짜가 나열된 라벨은 첫 날짜만 본다.
  3. `newYesterday`는 취소를 제외한다(기존 크론은 제외하지 않았다).
  1·3 때문에 크론 메일의 "오늘 살롱 방문"·"어제 신규 신청" 숫자가 기존과 달라질 수 있다 — 둘 다 의도한 수정이다.

### `src/lib/retreat-sessions.ts` (Max)
```ts
export const RETREAT_SESSIONS: { key: string; label: string; start: string; end: string }[]; // 기존 page.tsx:921·retreat/page.tsx 값 그대로
```

### `POST /api/admin/status` (Max)
```ts
body: { sheet?: "booking" | "retreat" | "open"; row: string[]; action: "confirm" | "cancel" | "reopen"; reason?: string }
// booking(기본): confirm → 입금확인(+confirmed 알림), cancel → 취소(+cancelled 알림, reason 있으면 M열에 "[취소사유] …" append), reopen → 신청(알림 없음)
// retreat: confirm → 입금확인, cancel → 취소, reopen → 신청 (알림 없음. 행 식별: 신청일시+연락처)
// open:    confirm → 확정,     cancel → 취소, reopen → 신청 (알림 없음)
// 409: 이미 같은 상태 / booking confirm은 현재 상태가 ""·신청일 때만
res: { ok: true; status: string; notify?: NotifyResult } | { ok: false; error: string; status?: string }
```
- `sheets.ts`: `updateRetreatStatus(createdAt, phone, status)`, `updateOpenStayStatus(createdAt, phone, status)`, `appendBookingMemo(type, createdAt, phone, text)` 추가. 열 위치는 `appendRetreat`/`appendOpenStay` 순서를 따른다.
- 판정은 순수 함수 `resolveStatusAction(sheet, currentStatus, action)`(`src/lib/admin-actions.ts`)에 있다. 구현 세부 3가지:
  1. **`reopen`은 이미 입금대기(`""` · `"신청"`)인 행에 오면 409.** 되돌릴 게 없다 → UI는 `isPending(status)`인 행에 [되돌리기]를 띄우지 않는다.
  2. **booking `confirm` 409 메시지**는 `'{현재상태}' 상태는 입금확인으로 바꿀 수 없습니다. 되돌리기 후 다시 시도해주세요.` — 취소/결제완료 행은 `reopen` → `confirm` 2단계.
  3. **retreat·open의 현재 상태는 body의 `row`에서 읽는다**(리트릿 `row[12]`, 무료개방 `row[11]`). booking만 시트를 다시 읽어 대조한다. 즉 리트릿·무료개방의 409는 화면이 들고 있는 값 기준 — 처리 후 목록 새로고침 필수.
- 행을 못 찾으면 404 `{ ok:false, error:"시트에서 신청 행을 찾지 못했습니다." }`. `reason`은 booking `cancel`에서만 쓰이고, 기록에 실패해도 상태 변경은 성공으로 응답한다.

### `GET /api/admin/notify-test` (Max)
- 발송 없이 `{ ok, missingRequired, missingKakao, kakaoMode, operatorPhoneMasked }` 반환. POST는 기존(실제 발송).

### `src/app/api/admin/bookings` — 변경 없음.

### 화면 (Esther)
- `src/components/SiteChrome.tsx` ("use client", `usePathname`) — `/admin`으로 시작하면 Nav/Footer 없이 children만. `src/app/layout.tsx`는 `<SiteChrome>{children}</SiteChrome>`로 교체(파일 이동 없음).
- `src/app/admin/layout.tsx` — `metadata: { title: "어드민 | 코이노니아", robots: { index: false, follow: false } }`.
- `src/app/admin/page.tsx` — 인증 + 데이터 로드 + 탭 셸만. 나머지는 `src/app/admin/_components/` 아래 파일로 분리: `TodayTab`, `ListTab`(+`BookingCard`, `BookingTable`, `BookingDrawer`), `StayCalendarTab`, `RetreatTab`, `OpenStayTab`, `SettingsTab`, `ConfirmCancelDialog`, `StatusBadge`, `NotifyStatus`, `RowActions`, `Banner`, `SummaryCard`, `useAdminApi`(fetch 래퍼: 비밀번호 헤더, 401 처리).
- 데이터: `/api/admin/bookings` 한 번 받아 `buildDigest`를 클라이언트에서 호출(추가 요청 0). 캘린더용 `/api/availability`는 오늘 탭에서도 호출해 이중예약 배너에 사용.

## 3. AC
```
npm run typecheck && npm run test && npm run build
npx eslint src/lib src/app/api src/app/admin src/components/SiteChrome.tsx
curl -s http://localhost:3001/admin | grep -c "<nav"            # 0
curl -s http://localhost:3001/admin | grep -c 'noindex'         # ≥1
curl -s http://localhost:3001/ | grep -c "<nav"                 # ≥1 (공개 사이트는 그대로)
```
- 세로 글자 깨짐 점검: 360px·390px·768px·1280px에서 각 탭. Chrome 도구가 없으면 코드로 `whitespace-nowrap`/`min-w`/`overflow-x-auto` 적용 여부를 grep으로 확인하고, 사용자가 로컬에서 최종 확인.

## 4. 범위 밖
- 루트 레이아웃 route group 분리(파일 이동) — 동시 작업자 충돌 위험으로 이번엔 `SiteChrome` 방식.
- 리트릿 회차 데이터 갱신(운영 결정 필요).

## 5. 통계 탭 복원 (2026-09-07 운영 요청)

C8의 "통계 탭 폐기"는 철회. 현황 파악용 **운영 통계 탭**을 7번째 탭으로 둔다 (탭 순서: 오늘 | 목록 | 통계 | 스테이 캘린더 | 리트릿 | 무료개방 | 설정).

### 화면
- 상단 컨트롤: 기간 `일별(최근 30일) / 월별(최근 12개월) / 연도별(전체)` · 지표 `건수 / 금액` · 구분 `전체 / 살롱 / 스테이`
- 비교 카드 3개: 이번 달 vs 지난 달 · 올해 vs 작년 · 전년 동월 대비 — 값, 증감(±N, ±%)
- 막대 그래프(CSS, 라이브러리 없음): 살롱·스테이 색으로 쌓은 막대. 각 막대 `aria-label`. 아래에 같은 데이터 **표**(기간 · 살롱 · 스테이 · 합계).
- 하단 분석 3개: 살롱 프로그램별 확정 수(상위 10), 객실별 확정 박수, 할인 적용 비율(없음/곁/나그네)
- 계산 기준 문구를 화면에 명시: "확정 = 입금확인·결제완료, 취소 제외. 신청 건수는 별도 표기."
- 빈 상태: "아직 집계할 데이터가 없어요" + 기준 안내.

### 계약 — `src/lib/stats.ts` (Max, 순수 함수, 테스트)
```ts
export type Bucket = { key: string; label: string; salonCount: number; stayCount: number; salonAmount: number; stayAmount: number; requested: number };
//  key: 일별 "YYYY-MM-DD", 월별 "YYYY-MM", 연도별 "YYYY". label: "9/7", "2026-09" → "9월"(연도 바뀌면 "2026년 1월"), "2026년"
export type Comparison = { label: string; current: number; previous: number; diff: number; pct: number | null; unit: "건" | "원" };
export type Stats = {
  daily: Bucket[];    // 최근 30일, 빈 날도 0으로 채움, 오래된 → 최신
  monthly: Bucket[];  // 최근 12개월, 빈 달 0
  yearly: Bucket[];   // 데이터가 있는 연도 전부(오름차순)
  compare: { monthCount: Comparison; monthAmount: Comparison; yearCount: Comparison; yearAmount: Comparison; yoyMonthCount: Comparison; yoyMonthAmount: Comparison };
  byProgram: { name: string; count: number; amount: number }[]; // 살롱 확정, count desc, 상위 10
  byRoom: { room: string; nights: number; count: number; amount: number }[];
  discount: { none: number; geot: number; nagnae: number };   // 확정 기준 건수
  basis: { confirmedStatuses: string[]; excludes: string[] };
};
export function buildStats(bookings: string[][], now?: Date): Stats; // 헤더 행 포함 배열, 신청일시(A열) 기준 버킷팅, 확정 = isConfirmed(N열), 취소 제외, requested = 취소 제외 전체 신청 수
```
- 날짜 파싱은 `digest.ts`의 `parseSheetDateTime`/`normalizeDate` 재사용. 금액은 L열 숫자만 추출.
- 헤더 스트립의 `digest.month`와 `stats.compare.monthCount.current`가 같은 값이어야 한다(테스트로 고정).

### 화면 (Esther) — `src/app/admin/_components/StatsTab.tsx`
- `dataviz` 스킬을 먼저 로드해 색·막대·축·툴팁 규칙을 따른다. 색은 토큰: 살롱 `bg-orange`, 스테이 `bg-teal`, 비교 증가 `text-teal-dark`, 감소 `text-orange-dark`(값 옆 아이콘/부호 병기, 색만으로 전달 금지).
- 막대는 `div` 높이 비율. 컨테이너 `overflow-x-auto`, 일별 30개 막대는 최소 폭 확보(막대당 ≥ 16px + gap). 라벨 `whitespace-nowrap`, 긴 축은 격일/격월 라벨 생략.
- AdminShell TABS에 `{ key: "stats", label: "통계" }` 추가, preview에도 반영.

## 6. 운영 피드백 반영 (2026-09-08, 배포 후)

### 6.1 행 식별을 시트 행 번호로 (Max)
- 문제: 연락처·신청일시가 빈 행(시트에 손으로 넣은 스테이 10건)은 `findBookingRow`가 못 찾아 입금확인이 400 "예약 정보가 없습니다"로 실패. 화면엔 작은 글씨로만 남아 "아무것도 안 뜨는" 것처럼 보임.
- `getAllBookings`가 각 행에 **출처 탭과 시트 행 번호**를 붙인다: 반환 형태를 `{ header, rows: { tab: "살롱"|"스테이", rowNum: number, values: string[] }[] }`로 바꾸지 말고, 호환 위해 기존 `string[][]`는 유지하되 **각 행 끝에 숨은 열 없이** 별도 배열 `meta: { tab, rowNum }[]`를 `/api/admin/bookings` 응답에 추가한다 (`{ rows, retreats, openStays, meta }`). 리트릿·무료개방도 동일하게 `retreatMeta`, `openMeta`.
- `POST /api/admin/status`·`/resend` body에 `ref?: { tab: string; rowNum: number }` 추가. `ref`가 있으면 **행 번호로 직접** 읽고 쓴다(`findBookingRow` 우회). 없으면 기존 방식. `updateNotifyStatus`·`updateBookingStatus`·`appendBookingMemo`에 `ref` 인자 경로 추가.
- `row[3]`(연락처) 필수 검사 제거. 연락처가 없으면 알림 발송은 `skipped`로 두고 상태 변경은 진행. 응답에 `notify.guest === "skipped"` 사유 `"연락처 없음"`을 포함.
- 신청일시가 빈 행은 목록에서 **정렬 맨 아래**, 신청일 칸은 "—".

### 6.2 처리 결과 팝업 (Esther)
- 입금확인·취소·재발송·되돌리기 결과를 행 안 텍스트 **대신** 화면 우상단 **토스트**(`role="status"`, `aria-live="polite"`)로 띄운다. 성공: teal 배경 "김성연 · 입금확인 완료 · 게스트 알림톡 발송됨", 실패: orange 배경 "입금확인 실패 — 예약 정보가 없습니다" + [다시 시도]. 5초 후 자동 닫힘, 호버 시 유지, 닫기 버튼. 여러 개면 세로로 쌓임(최대 3).
- 실패 시 토스트 외에 해당 행도 빨간 테두리 2초 강조.
- 처리 중엔 버튼 스피너 + 행 전체 `opacity-60`, 완료 후 목록 재조회.

### 6.3 목록을 리스트형으로 (Esther)
- 목록 탭·오늘 탭 입금대기 섹션의 **카드형 제거**. 모든 폭에서 **한 줄 리스트 행**:
  - `md` 이상: 표 (열: 신청일 · 이름 · 구분 · 내용 · 일시 · 금액 · 연락처 · 상태 · 알림 · 처리). 처리 열 sticky right, 이름 sticky left.
  - `md` 미만: 2줄 리스트 행 — 1줄 `이름  구분·내용  [상태배지]`, 2줄 `신청일 · 일시 · 금액 · 연락처(tel)`, 3줄(있을 때만) `알림 상태 + 버튼들`. 행 구분선만, 카드 테두리·라운드 없음. 행 탭하면 drawer.
- **신청일** 열/항목 추가: A열 `parseSheetDateTime` → `M/D HH:mm`, 빈값 "—". 표 기본 정렬 신청일 내림차순 유지.
- 리트릿·무료개방 탭도 같은 리스트형(카드 제거).

### 6.4 고정 헤더 + 검색창 (Esther)
- AdminShell 헤더(제목·날짜·새로고침·로그아웃 + 이번 달 스트립 + 탭 스트립)를 `sticky top-0 z-30 bg-cream/95 backdrop-blur`로 고정. 본문 `scroll-mt`로 앵커 보정.
- 헤더 안에 **전역 검색창** (탭 스트립 오른쪽, `md` 미만은 탭 스트립 아래 한 줄): placeholder "이름·연락처·프로그램 검색", 입력 시 자동으로 목록 탭으로 이동하고 `listFilters.searchInput`에 반영(200ms 디바운스). 결과 건수 표시. `/` 키로 포커스, Esc로 비움.
- 목록 탭 안의 기존 검색 input은 제거(전역 검색창으로 통합), 구분·상태·기간 칩은 유지.

### AC
기존 AC + `POST /api/admin/status` with `ref` 경로 테스트(순수 함수로 분리 가능한 부분), 연락처 없는 행에 confirm → 200 + guest skipped. 스크린샷 390/1280 today·list 재촬영.
