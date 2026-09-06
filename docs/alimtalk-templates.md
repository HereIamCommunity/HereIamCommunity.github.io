# 알림톡 템플릿 등록 문안 (솔라피 콘솔용)

솔라피 콘솔 > 카카오 채널 > 알림톡 템플릿 > 새 템플릿. 아래 문안을 **그대로** 등록하고 검수를 요청한다. 승인 후 발급되는 템플릿 ID를 Vercel 환경변수에 넣는다.

공통 규칙
- 변수는 `#{이름}` 형식. 코드가 넣는 변수 키와 정확히 일치해야 한다.
- 템플릿 유형: 기본형. 강조 표기 없음. 광고성 문구 금지(검수 반려 사유).
- 버튼: 웹링크 1개 권장 (아래 표기). 버튼은 검수와 무관하게 선택.
- 계좌 정보는 변경 시 코드(`src/lib/kakao.ts` 상단 상수)와 템플릿을 함께 바꿔야 한다.

---

## 1. 살롱 접수 — `KAKAO_TEMPLATE_SALON_RECEIVED`

변수: `#{name}` `#{program}` `#{date}` `#{amount}`

```
안녕하세요, #{name}님.
코이노니아 살롱 신청이 접수되었습니다.

■ 신청 내역
프로그램: #{program}
일시: #{date}
참가비: #{amount}원

아래 계좌로 입금해 주시면 참가가 확정됩니다.
하나은행 5539-10-13844507 (코이노니아)
입금자명: #{name}

입금이 확인되면 확정 안내를 다시 보내드립니다.
```

버튼: `예약 확인하기` → https://koinonia-web.vercel.app/booking-check

---

## 2. 스테이 접수 — `KAKAO_TEMPLATE_STAY_RECEIVED`

변수: `#{name}` `#{room}` `#{checkIn}` `#{checkOut}` `#{nights}` `#{amount}`

```
안녕하세요, #{name}님.
코이노니아 스테이 예약 신청이 접수되었습니다.

■ 예약 내역
객실: #{room}
체크인: #{checkIn}
체크아웃: #{checkOut} (#{nights}박)
총 금액: #{amount}원

아래 계좌로 입금해 주시면 예약이 확정됩니다.
하나은행 5539-10-13844507 (코이노니아)
입금자명: #{name}

입금이 확인되면 확정 안내를 다시 보내드립니다.
```

버튼: `예약 확인하기` → https://koinonia-web.vercel.app/booking-check

---

## 3. 살롱 확정 — `KAKAO_TEMPLATE_SALON_CONFIRMED`

변수: `#{name}` `#{program}` `#{date}`

```
#{name}님, 코이노니아 살롱 참가가 확정되었습니다.

■ 확정 내역
프로그램: #{program}
일시: #{date}
장소: 코이노니아 (경북 안동시)

당일 일정 변경이 필요하시면 인스타그램 @koinonia_andong 으로 미리 연락 부탁드립니다.

코이노니아에서 뵙겠습니다.
```

버튼: `오시는 길` → https://koinonia-web.vercel.app/about

---

## 4. 스테이 확정 — `KAKAO_TEMPLATE_STAY_CONFIRMED`

변수: `#{name}` `#{room}` `#{checkIn}` `#{checkOut}` `#{nights}`

```
#{name}님, 코이노니아 스테이 예약이 확정되었습니다.

■ 확정 내역
객실: #{room}
체크인: #{checkIn} 15:00
체크아웃: #{checkOut} 11:00 (#{nights}박)

체크인 전날 입실 방법과 스테이 가이드를 다시 안내드립니다.
숙박 관련 문의는 언제든 편하게 연락 주세요.

안동에서 뵙겠습니다.
```

버튼: `스테이 가이드` → https://shorturl.at/ZCjqD

---

## 5. 취소 안내 (게스트 공통) — `KAKAO_TEMPLATE_CANCELLED`

변수: `#{name}` `#{type}` `#{detail}`

- `#{type}`: `살롱` 또는 `스테이`
- `#{detail}`: 살롱은 `프로그램명 / 일시`, 스테이는 `객실 / 체크인 ~ 체크아웃`

```
#{name}님, 코이노니아 #{type} 예약이 취소 처리되었습니다.

■ 취소 내역
#{detail}

이미 입금하신 경우 환불 안내를 별도로 드립니다.
문의: 인스타그램 @koinonia_andong

다음에 다시 뵙기를 기다리겠습니다.
```

---

## 6. 호스트 알림 (공통) — `KAKAO_TEMPLATE_HOST`

수신: 운영자(`OPERATOR_PHONE`). 접수·확정·취소를 `#{event}` 변수로 구분.

변수: `#{event}` `#{type}` `#{name}` `#{phone}` `#{detail}` `#{amount}`

- `#{event}`: `새 신청` / `입금확인 완료` / `취소 처리`
- `#{type}`: `살롱` / `스테이`

```
[코이노니아] #{event} · #{type}

이름: #{name}
연락처: #{phone}
내용: #{detail}
금액: #{amount}원
```

버튼: `어드민 열기` → https://koinonia-web.vercel.app/admin

---

## 문자 대체 발송

알림톡이 실패하면(채널 차단, 카카오 미가입, 템플릿 미승인 등) 솔라피가 같은 내용을 문자(SMS/LMS)로 자동 발송한다. 코드는 위 문안과 동일한 텍스트를 대체 문구로 함께 보내므로 별도 설정이 필요 없다. 발신번호(`SOLAPI_SENDER_PHONE`)가 등록되어 있어야 대체 발송이 동작한다.

## 템플릿 ID 등록 후 확인

1. Vercel에 `KAKAO_TEMPLATE_*` 6개 입력 → 재배포
2. 어드민 페이지 > "알림 테스트" 클릭 → 호스트 번호로 샘플 알림톡 수신 확인
3. 실패 시 화면에 표시되는 솔라피 오류 코드 확인 (예: 템플릿 변수 불일치, pfId 오류)
