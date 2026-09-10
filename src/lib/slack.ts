/**
 * 슬랙 봇 알림 (chat.postMessage).
 *
 * 호스트(운영자) 알림을 채널로 보낸다. 라이브러리 없이 fetch만 쓴다.
 *
 * 환경변수:
 *   SLACK_BOT_TOKEN   — Bot User OAuth Token (xoxb-…). 스코프 chat:write
 *   SLACK_CHANNEL_ID  — 알림 받을 채널 ID (C0…). 봇을 그 채널에 /invite 해둬야 한다.
 *
 * 둘 중 하나라도 없으면 `{ ok:false, error:"not-configured" }`를 주고 호출부가 문자로 대체한다.
 */

const SLACK_URL = "https://slack.com/api/chat.postMessage";
const TIMEOUT_MS = 5000;

/** Block Kit 블록. 구조는 slack-blocks.ts가 만든다. */
export type SlackBlock = Record<string, unknown>;

/** 슬랙에 보낼 한 통. `text`는 알림 미리보기(fallback) 문구다. */
export type SlackMessage = { blocks: SlackBlock[]; text: string };

export type SlackResult = { ok: true; ts?: string } | { ok: false; error: string };

/** 설정된 채널 ID (없으면 null). 어드민 설정 탭 표시용. */
export function slackChannelId(): string | null {
  return process.env.SLACK_CHANNEL_ID || null;
}

/** 토큰과 채널이 모두 있는지. */
export function isSlackConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID);
}

/**
 * 채널에 한 통 보낸다.
 * 슬랙이 주는 오류 코드(`channel_not_found`, `not_in_channel`, `invalid_auth` …)를 그대로 돌려준다
 * — 운영자가 어떤 설정이 틀렸는지 바로 알아야 하기 때문이다.
 */
export async function postSlack({ blocks, text }: SlackMessage): Promise<SlackResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) return { ok: false, error: "not-configured" };

  try {
    const res = await fetch(SLACK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text, blocks }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const data = (await res.json()) as { ok?: boolean; ts?: string; error?: string };
    if (!data?.ok) return { ok: false, error: data?.error || `http_${res.status}` };
    return { ok: true, ts: data.ts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
