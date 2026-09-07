/**
 * 리트릿(72시간 썸머캠프) 회차 정의 — 단일 출처.
 *
 * label 문자열은 시트 F열에 그대로 적히는 값이다(`sheets.ts` appendRetreat의 SESSION_LABELS).
 * 카운트는 `label.split(" ")[0]`("1회차" 등) 포함 여부로 매칭하므로 표기를 바꾸면
 * 시트에 이미 쌓인 값과 어긋난다 — 바꿀 땐 시트 데이터도 같이 손봐야 한다.
 */
export const RETREAT_SESSIONS: {
  key: string;
  label: string;
  start: string;
  end: string;
}[] = [
  { key: "s1", label: "1회차 7/3-5", start: "2026-07-03", end: "2026-07-05" },
  { key: "s2", label: "2회차 7/24-26", start: "2026-07-24", end: "2026-07-26" },
  { key: "s3", label: "3회차 7/30-8/1", start: "2026-07-30", end: "2026-08-01" },
  { key: "s4", label: "4회차 8/15-17", start: "2026-08-15", end: "2026-08-17" },
  { key: "s5", label: "5회차 8/21-23", start: "2026-08-21", end: "2026-08-23" },
];

/** 정원 (회차당) */
export const RETREAT_CAPACITY = 6;
