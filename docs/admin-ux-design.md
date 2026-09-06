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
- `src/app/api/cron/morning-digest/route.ts`는 `buildDigest`를 쓰도록 교체(로직 중복 제거, 메일 내용 동일).

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
