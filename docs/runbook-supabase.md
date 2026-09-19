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
