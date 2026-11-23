# 코이노니아 웹 — Claude 작업 가이드

이 파일은 Claude Code가 세션 시작마다 자동으로 읽는다.
새 대화창을 열어도 이 파일 덕분에 컨텍스트 없이 바로 작업 시작 가능.

---

## 1. 프로젝트 개요

경북 안동의 문화공간 코이노니아(히어아이엠 운영)의 웹사이트 + 어드민.
Next.js 15 App Router · TypeScript · Tailwind CSS v4 · Vercel 배포.

**배포 URL:** `https://koinonia-web.vercel.app`
**로컬 체크아웃:** `/Users/chloe/Downloads/koinonia-web` ← 이것만 사용. 커밋·푸시 항상 여기서.
**GitHub:** `HereIamCommunity/HereIamCommunity.github.io` (main → Vercel 자동 배포)

---

## 2. 아키텍처 한 장 요약

```
브라우저 (Next.js)
  └─ /api/booking          ← 예약 접수 (살롱·스테이)
  └─ /api/availability     ← Airbnb iCal 파싱 → 방별 블록 날짜 반환
  └─ /api/calendar/[room].ics ← 웹사이트 예약을 iCal로 내보냄 (Airbnb 역싱크용)
  └─ /api/payment/confirm  ← 토스페이먼츠 결제 승인
  └─ /api/admin/*          ← 어드민 데이터·상태 변경·알림 재발송

서버
  └─ Google Sheets         ← 모든 예약 데이터의 DB (lib/sheets.ts)
  └─ Solapi (카카오 알림톡 + SMS)  ← lib/notify.ts, lib/messaging.ts
  └─ Resend (이메일)        ← lib/email.ts
  └─ Slack (호스트 알림)    ← lib/slack.ts, lib/host-notify.ts

Cron (Vercel, 매일 KST 기준 실행)
  └─ /api/cron/stay-reminder   UTC 23:00 (= KST 08:00) — 체크인 D-1 알림
  └─ /api/cron/stay-checkout   UTC 00:00 (= KST 09:00) — 체크아웃 당일 알림
  └─ /api/cron/salon-reminder  UTC 23:00 (= KST 08:00) — 살롱 D-1 알림
  └─ /api/cron/morning-digest  UTC 23:00 (= KST 08:00) — 운영자 일일 요약
```

---

## 3. Google Sheets 구조 (핵심 — 여기서 버그가 가장 많이 난다)

### 시트 탭

| 탭명     | 용도                    | 행 범위 |
|--------|----------------------|--------|
| 살롱     | 살롱 예약                | A:O    |
| 스테이   | 스테이 예약              | A:O    |
| 리트릿   | 리트릿 신청              | A:M    |
| 무료개방 | 무료개방 스테이 신청       | A:L    |
| _bulk_log | 일괄 처리 이력         | 별도    |

### 살롱·스테이 열 매핑 (A=0, B=1, … O=14)

```
[0]  A  신청일시    "2026. 9. 6. 오후 7:10:32" (한국어 로케일 형식)
[1]  B  구분        "살롱" | "스테이"
[2]  C  이름
[3]  D  연락처      하이픈 없이 저장 권장, 실제로는 혼재
[4]  E  프로그램    살롱 프로그램명 (스테이는 빈값)
[5]  F  일시        살롱 일시 문자열 (스테이는 빈값)
[6]  G  객실        "나그네방" | "옥순방" | "여태방" (살롱은 빈값)
[7]  H  박수        숫자 문자열
[8]  I  체크인      날짜 — 아래 날짜 형식 주의사항 참고
[9]  J  체크아웃    날짜 — 아래 날짜 형식 주의사항 참고
[10] K  할인        "없음" | "멤버십 곁 (-20%)" | "나그네방 후원자 (-30%)"
[11] L  결제금액    숫자 (원)
[12] M  요청사항    자유 텍스트, 취소 사유도 여기에 append
[13] N  상태        "신청" | "입금확인" | "결제완료" | "취소"
[14] O  알림        "✅ HH:MM 접수" | "❌ 실패" | "🔕 건너뜀" | 비어있음
```

### 날짜 형식 주의사항 ⚠️

**API가 저장하는 형식:** `"2026-11-09"` (ISO, zero-padded)
**시트에 수동 입력 시:** `"2026. 11. 9."` (한국어 점-공백 형식, zero-pad 없음)

→ 날짜 비교는 **반드시 `normalizeDate()`를 거쳐야 한다** (`lib/digest.ts`).
→ cron에서 시트 날짜를 읽을 때는 regex + `.padStart(2, "0")` 적용 필수.
→ 절대로 단순 문자열 비교(`===`) 하지 말 것.

---

## 4. iCal 약속 ⚠️ (반복 버그 발생 지점)

Airbnb iCal 표준: **DTEND = 체크아웃일 그 자체 (exclusive end)**

```
체크인 11/21, 체크아웃 11/22 (1박) → DTSTART=20261121, DTEND=20261122
```

**overlap 판정 (반개구간 [checkIn, checkOut) ∩ [start, end)):**
```typescript
ci < e && co > s   // ← 올바른 조건
ci <= e && co > s  // ← 버그 (체크아웃일에 새 체크인 차단)
```

**calendar API 내보내기:** DTEND = 체크아웃일 그대로 (절대 +1일 하지 말 것).
→ 2026-11-23 커밋에서 +1 버그 수정 완료.

**Airbnb 역반영 주의:**
Airbnb가 `/api/calendar/[room].ics`를 싱크하면 웹사이트 예약이 Airbnb "Not available" 블록으로 반영됨.
`/api/availability`가 이걸 다시 읽어 "중복 주의"로 오인하는 버그 존재.
→ `dayStatus()`에서 에어비앤비 블록의 start가 웹사이트 예약 체크인과 같으면 역반영으로 간주하고 무시 (`shared.ts`).

---

## 5. 환경변수 목록

Vercel Project Settings에서 관리. 로컬은 `.env.local` (`.env.example` 참고).

```
# 어드민
ADMIN_PASSWORD

# Google Sheets
GOOGLE_SHEET_ID
GOOGLE_SERVICE_ACCOUNT_JSON   ← JSON 전체를 한 줄로

# Solapi (카카오 알림톡 + SMS)
SOLAPI_API_KEY
SOLAPI_API_SECRET
SOLAPI_SENDER_PHONE
OPERATOR_PHONE
KAKAO_PFID
KAKAO_TEMPLATE_SALON_RECEIVED / _CONFIRMED / _CANCELLED
KAKAO_TEMPLATE_STAY_RECEIVED / _CONFIRMED / _CANCELLED
KAKAO_TEMPLATE_STAY_REMINDER / _CHECKOUT  ← cron 발송, 없으면 SMS 대체
KAKAO_TEMPLATE_SALON_REMINDER             ← cron 발송, 없으면 SMS 대체

# Slack (호스트 알림)
SLACK_BOT_TOKEN
SLACK_CHANNEL_ID

# Resend (이메일)
RESEND_API_KEY
RESEND_FROM_EMAIL
OPERATOR_EMAIL

# 토스페이먼츠
NEXT_PUBLIC_TOSS_CLIENT_KEY   ← 프론트엔드 (NEXT_PUBLIC_ 접두사 필수)
TOSS_SECRET_KEY               ← 서버사이드만

# Airbnb iCal
AIRBNB_ICAL_NAGNAE / _OKSUN / _YEUTAE

# Cron 인증
CRON_SECRET
```

---

## 6. 핵심 lib 파일 역할

| 파일 | 역할 |
|------|------|
| `lib/sheets.ts` | Google Sheets 읽기·쓰기 전담. 열 번호는 여기서 확인할 것 |
| `lib/digest.ts` | `normalizeDate`, `parseSheetDateTime`, `kstNow`, `buildDigest` — 날짜 관련 순수 함수 집합. **날짜 처리 시 반드시 여기를 먼저 확인** |
| `lib/messaging.ts` | 예약 상태 알림 (접수·확정·취소) — 살롱·스테이 공통 |
| `lib/notify.ts` | cron 안내 발송 (D-1 체크인, 체크아웃, 살롱 D-1) |
| `lib/host-notify.ts` | 호스트(운영자)에게 슬랙·SMS 알림 |
| `lib/email.ts` | Resend 이메일 발송 |
| `lib/kakao.ts` | 카카오 알림톡 옵션 조립 |
| `lib/list-filter.ts` | 어드민 목록 필터·정렬 (서버·클라이언트 공유) |
| `lib/programs.ts` | 살롱 프로그램 정의, 정원 확인 |

---

## 7. 어드민 구조

**경로:** `/admin` (ADMIN_PASSWORD 쿠키 인증)
**탭:** 목록 · 오늘 · 스테이 캘린더 · 리트릿 · 무료개방 · 통계 · 메시지 · 설정

**스테이 캘린더 (`StayCalendarTab.tsx`):**
- 방 선택 없이 3개 방(나그네·옥순·여태)을 하나의 캘린더에 점 3개로 표시
- 색: teal=웹사이트, orange=에어비앤비, brown=중복, gray=비어있음
- 오른쪽 패널: 전체 방 예약 날짜순 목록 (성함 + 방 배지)
- 에어비앤비 게스트 이름: iCal SUMMARY 필드 `Airbnb (FirstName L.)` 파싱

**공유 타입:** `app/admin/_components/shared.ts`
- `DateRange = { start, end, summary? }` — summary는 Airbnb iCal SUMMARY
- `Row = string[]` — 시트 한 행 그대로
- `dayStatus()` — "website" | "airbnb" | "both" | "available" 반환

---

## 8. 알림 발송 흐름

```
예약 접수 (/api/booking)
  → notifyBooking("received") — 게스트 카카오/SMS
  → sendOperatorAlert()       — 운영자 이메일
  → sendGuestConfirmation()   — 게스트 이메일

어드민 확정/취소 (/api/admin/status)
  → notifyBooking("confirmed" | "cancelled") — 게스트 카카오/SMS

Cron D-1 체크인 (/api/cron/stay-reminder, UTC 23:00)
  → sendCheckinReminderSMS() — 체크인 D-1 안내

Cron 체크아웃 (/api/cron/stay-checkout, UTC 00:00)
  → sendCheckoutSMS() — 체크아웃 당일 안내

Cron 살롱 D-1 (/api/cron/salon-reminder, UTC 23:00)
  → sendSalonReminderSMS()
```

---

## 9. 커밋·배포 규칙

- **커밋 전 반드시 사용자 검토·승인** 후 push
- `npx tsc --noEmit` 타입 에러 없어야 커밋
- main push → Vercel 자동 배포 (약 1~2분)
- `.env.local` 절대 커밋 금지

---

## 10. 반복 발생 버그 패턴 (이미 수정됨, 재발 방지용)

| 버그 | 원인 | 수정 |
|------|------|------|
| 옥순방·나그네방 예약 차단 | `isOverlapping`에서 `ci <= e` (체크아웃일 체크인 차단) | `ci < e` |
| cron D-1 메시지 미발송 | 시트 수동입력 날짜 `"2026. 11. 9"` ≠ `"2026-11-09"` | regex + padStart |
| calendar export DTEND 오류 | 체크아웃일에 +1일 추가 | 체크아웃일 그대로 사용 |
| 가짜 "중복 주의" 경고 | Airbnb가 우리 iCal 싱크 → 역반영 블록을 중복으로 카운팅 | `dayStatus()`에서 start 일치 시 역반영으로 간주 |

---

## 11. 토스페이먼츠 (연동 대기 중)

- 백엔드: `/api/payment/confirm` — 구현 완료
- 프론트: `StayBookingForm.tsx` — 아직 계좌이체 안내만 있음
- 필요한 환경변수: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`
- 키 발급 후 Vercel 환경변수 추가 → 프론트엔드 위젯 연동 작업 시작
