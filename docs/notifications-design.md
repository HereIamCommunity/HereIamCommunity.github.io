# 예약 알림 자동화 설계 (솔라피 알림톡 + Vercel)

작성일: 2026-09-06 · 상태: 승인됨 (구현 진행)

## 1. 목표

예약 상태가 바뀔 때마다 **게스트와 호스트 양쪽**에 카카오 알림톡이 자동 발송되고, 알림톡이 안 되면 문자로 자동 대체된다. 상태 변경은 어드민 클릭 한 번(입금확인·취소) 또는 토스 카드결제 승인으로 일어난다.

## 2. 이벤트 모델

| 이벤트 키 | 발생 시점 | 게스트 | 호스트 |
|---|---|---|---|
| `received` | `/api/booking` POST (계좌이체 신청 접수) | 접수 + 입금 안내 | 새 신청 알림 |
| `confirmed` | `/api/admin/status` (입금확인) 또는 `/api/payment/confirm` (토스 승인) | 확정 안내 | 확정 처리 알림 |
| `cancelled` | `/api/admin/status` (취소) | 취소 안내 | 취소 처리 알림 |

- 기존 cron 문자(`stay-reminder` D-1, `stay-checkout` 당일)는 이번 범위 밖. 그대로 유지.
- 리트릿·오픈스테이 폼은 이번 범위 밖 (살롱·스테이만).

## 3. 솔라피 연결 설계

### 3.1 발송 경로

```
Vercel Function (Node.js, Fluid Compute)
  └─ src/lib/messaging.ts  notifyBooking(event, booking)
       └─ src/lib/kakao.ts  buildMessages() → SolapiMessageService.send([...])
            ├─ 게스트 메시지: kakaoOptions{pfId, templateId, variables} + text(대체 문구)
            └─ 호스트 메시지: kakaoOptions{pfId, templateId, variables} + text(대체 문구)
                 ↓ Solapi
            알림톡 시도 → 실패(채널 차단·미가입·템플릿 오류) 시 disableSms=false 이므로 text로 SMS/LMS 자동 대체
```

- 게스트와 호스트 메시지를 **한 번의 `send([...])` 호출**로 보낸다. 응답 `DetailGroupMessageResponse`의 `groupId`와 `failedMessageList`로 건별 성공/실패를 판별한다.
- 문자 대체 문구(`text`)는 알림톡 본문과 동일한 내용으로 조립한다. 90바이트 초과 시 솔라피가 LMS로 자동 전환하므로 길이 제한은 신경 쓰지 않는다.
- 템플릿 ID 환경변수가 비어 있으면 `kakaoOptions` 없이 `text`만 보내 **순수 문자로 발송**한다. 템플릿 검수가 끝나기 전에도 알림이 끊기지 않게 하기 위함.
- `SOLAPI_API_KEY`가 없으면 발송을 건너뛰고 `skipped` 결과를 돌려준다(로컬 개발).

### 3.2 솔라피 콘솔에서 준비할 것 (사람이 직접)

1. **API 키**: 콘솔 > API Key 관리 > 키 발급 → `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`
2. **발신번호 등록**: 콘솔 > 발신번호 관리 > 등록·인증 → `SOLAPI_SENDER_PHONE` (하이픈 없이). 문자 대체 발송에 필수.
3. **카카오 채널 연동**: 콘솔 > 카카오 채널 관리 > 채널 연동 → 채널 검색용 ID로 연동 → 발급된 `pfId` → `KAKAO_PFID`
4. **알림톡 템플릿 6개 등록**: `docs/alimtalk-templates.md`의 문안·변수 그대로 등록 → 검수 요청 → 승인 후 템플릿 ID를 `KAKAO_TEMPLATE_*` 6개에 입력
5. **잔액 충전** 및 자동충전 설정 권장.

### 3.3 Vercel 환경변수

Vercel 대시보드 > Project > Settings > Environment Variables. **Production과 Preview 양쪽**에 넣는다. 값을 바꾼 뒤엔 재배포가 필요하다.

| 변수 | 용도 | 비고 |
|---|---|---|
| `SOLAPI_API_KEY` | 솔라피 인증 | 기존 |
| `SOLAPI_API_SECRET` | 솔라피 인증 | 기존 |
| `SOLAPI_SENDER_PHONE` | 발신번호 | 기존, 하이픈 없이 |
| `KAKAO_PFID` | 카카오 채널 ID | 기존 |
| `KAKAO_TEMPLATE_SALON_RECEIVED` | 살롱 접수 | 신규 |
| `KAKAO_TEMPLATE_STAY_RECEIVED` | 스테이 접수 | 신규 |
| `KAKAO_TEMPLATE_SALON_CONFIRMED` | 살롱 확정 | 신규 |
| `KAKAO_TEMPLATE_STAY_CONFIRMED` | 스테이 확정 | 신규 |
| `KAKAO_TEMPLATE_CANCELLED` | 취소 안내 (게스트 공통) | 신규 |
| `KAKAO_TEMPLATE_HOST` | 호스트 알림 (공통) | 신규 |
| `OPERATOR_PHONE` | 호스트 수신번호 | 기존, 하이픈 없이 |
| `ADMIN_PASSWORD` | 어드민 인증 | 기존 |

기존 `KAKAO_TEMPLATE_SALON`, `KAKAO_TEMPLATE_STAY`는 더 이상 읽지 않는다. 남아 있어도 무해.

### 3.4 연결 확인 (어드민 테스트 발송)

어드민 페이지 상단에 **"알림 테스트"** 버튼을 둔다. `POST /api/admin/notify-test`가 호스트 번호로 `received` 이벤트의 샘플 메시지(살롱, 이름 "테스트")를 실제 발송하고, 솔라피 응답(groupId, 성공/실패 건수, 실패 사유)을 그대로 화면에 표시한다. 환경변수 누락 시엔 어떤 변수가 비었는지 목록으로 보여준다. 이 버튼으로 배포 직후 연결 상태를 바로 검증한다.

### 3.5 발송 결과 기록

- 구글 시트 **O열(알림)** 에 `✅ 14:32 접수` / `✅ 15:01 확정` / `❌ 확정 실패: <사유>` 형식으로 기록. 기존 `updateNotifyStatus`를 재사용.
- 호스트 발송 실패는 O열에 `(호스트 ❌)`를 덧붙인다.
- Vercel 로그에 `[NOTIFY] event=confirmed guest=ok host=ok groupId=...` 한 줄을 남긴다.

### 3.6 재시도·중복 방지

- 발송은 1회 시도. 실패는 O열에 남기고 어드민의 **재발송** 버튼(기존)이 마지막 이벤트를 다시 보낸다. 재발송 API는 행의 상태(N열)를 보고 `신청`→received, `입금확인`→confirmed, `취소`→cancelled 로 이벤트를 고른다.
- 입금확인 API는 현재 상태가 이미 `입금확인`이면 시트를 건드리지 않고 409를 돌려준다(중복 클릭 방지). 취소도 동일.

## 4. 컴포넌트

### `src/lib/kakao.ts` (재작성)
- `type BookingEvent = "received" | "confirmed" | "cancelled"`
- `type Booking = { type: "salon"|"stay"; name; phone; program?; date?; room?; checkIn?; checkOut?; nights?; discount?; totalAmount; createdAt? }`
- `buildGuestMessage(event, booking) → { text, kakaoOptions? }` — 순수 함수. 템플릿 ID env가 있으면 `kakaoOptions` 포함.
- `buildHostMessage(event, booking) → { text, kakaoOptions? }` — 순수 함수.
- `sendBookingMessages(event, booking) → { guest: SendResult; host: SendResult; groupId? }` — 솔라피 호출. `SendResult = "ok" | "skipped" | { error: string }`.
- 계좌·인스타 등 상수는 파일 상단 한곳에.

### `src/lib/messaging.ts` (신규)
- `notifyBooking(event, booking, opts?: { recordToSheet?: boolean })` — `sendBookingMessages` 호출 → O열 기록 → 로그 → 결과 반환. API 라우트는 이것만 호출한다.
- 기존 `notify.ts`의 `sendGuestSMS`/`sendOperatorSMS`는 이번 변경 후 **호출처가 없어지므로 삭제**. `sendCheckoutSMS`, `sendCheckinReminderSMS`는 유지.

### `src/lib/sheets.ts`
- `updateBookingStatus(type, createdAt, phone, status) → boolean` — N열 갱신. `updateNotifyStatus`와 같은 행 탐색 로직을 공유하도록 내부 헬퍼 `findBookingRow`로 추출.
- `getBookingRow(type, createdAt, phone) → string[] | null` — 현재 상태 확인용.

### `src/app/api/admin/status/route.ts` (신규)
- `POST { row: string[]; action: "confirm" | "cancel" }`, 헤더 `x-admin-password`.
- 흐름: 인증 → 행 파싱(기존 resend 라우트의 파싱 로직을 `src/lib/admin-row.ts`로 추출해 공유) → 현재 상태 확인(중복이면 409) → N열 갱신 → `notifyBooking(confirmed|cancelled)` → `{ ok, status, notify }` 반환.

### `src/app/api/admin/notify-test/route.ts` (신규)
- `POST`, 헤더 인증. 환경변수 점검 → 샘플 발송 → 솔라피 응답 반환.

### `src/app/api/admin/resend/route.ts`
- 행 상태에 따라 이벤트를 고르고 `notifyBooking` 호출로 교체.

### `src/app/api/booking/route.ts`
- 시트 append **먼저** → `notifyBooking("received")` → 응답. (알림 실패가 저장을 막지 않게.)
- `sendOperatorAlert`/`sendGuestConfirmation` 이메일은 유지.

### `src/app/api/payment/confirm/route.ts`
- 토스 승인 → 시트 append(status `결제완료`) → `notifyBooking("confirmed")` → 이메일.

### `src/app/admin/page.tsx`
- 예약 행마다 상태가 `신청`이면 **입금확인**·**취소** 버튼, `입금확인`이면 **취소** 버튼. 처리 중엔 버튼 비활성 + "처리중…".
- 결과는 `alert()` 대신 행 안 인라인 텍스트(성공: 초록 "✅ 확정 · 알림 발송됨", 실패: 빨강 사유)로 표시하고 목록을 다시 불러온다.
- 상단에 "알림 테스트" 버튼 + 결과 패널.
- "상태 변경은 구글 시트에서" 안내 문구 삭제.

### `.env.example` (신규)
3.3 표의 변수 전체 + 기존 Google/Resend/Toss/Airbnb/CRON 변수.

## 5. 테스트

- `vitest` 추가 (`npm run test`). 대상은 순수 함수만:
  - `buildGuestMessage`/`buildHostMessage`: 이벤트×타입별 문안에 이름·금액·날짜가 들어가는지, 템플릿 env 유무에 따라 `kakaoOptions` 포함 여부, 변수 키가 `#{...}` 형식인지.
  - `parseAdminRow`: 어드민 행 → Booking 변환 (할인 코드, 금액 파싱).
  - 이벤트 선택 로직(상태 문자열 → 이벤트).
- 솔라피·구글 API는 모킹. 네트워크 호출 테스트 없음.
- AC: `npm run typecheck && npm run test && npm run build` exit 0. (`lint`는 기존 레거시 파일 오염으로 제외. `npx eslint src`로 새 파일만 확인.)

## 6. 범위 밖 (다음 단계 후보)

- 은행 입금 자동 감지(오픈뱅킹) — 별도 계약 필요.
- 솔라피 발송 결과 웹훅 수신 — 지금은 O열 기록으로 충분.
- 리트릿·오픈스테이 알림톡 전환.
- D-1·체크아웃 문자의 알림톡 전환.
