/**
 * DB(Supabase) 장애 경고 — 손님 신청이 실패했는데 아무도 모르는 상황을 막는다.
 *
 * 무료 플랜은 7일 동안 활동이 없으면 프로젝트가 일시정지된다. 그러면 모든 저장이 실패하므로
 * 경고에 "대시보드에서 Restore" 안내를 넣는다. 슬랙이 1순위, 안 되면 운영자 메일.
 * 신청이 몰릴 때 경고가 쏟아지지 않게 10분에 한 번으로 제한한다(인스턴스 단위).
 * 제한은 슬랙·메일 전송에만 걸린다. 로그는 실패마다 남긴다.
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
  const detail = errorText(err);
  console.error(`[DB-ALERT] ${context}: ${detail}`);

  if (lastSentAt !== null && now - lastSentAt < DB_ALERT_THROTTLE_MS) return "throttled";
  lastSentAt = now;

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
    const sent = await sendOperatorNotice("[코이노니아] DB 연결 실패", `작업: ${context}\n오류: ${detail}\n\n${HINT}`);
    return sent ? "email" : "failed";
  } catch (e) {
    console.error("[DB-ALERT] 메일 전송 실패", e);
    return "failed";
  }
}
