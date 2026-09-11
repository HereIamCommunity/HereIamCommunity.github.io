"use client";

import { useId } from "react";
import { FIELD, type ListRange } from "./shared";

/* ── 기간설정 한 줄 (9장) ────────────────────────────────
   기간 칩에서 [기간설정]을 고르면 칩 바로 아래 펼쳐지는 줄.
   기준(사용일/신청일) + 시작·종료 날짜 두 칸이고, 값이 바뀌면 곧바로 목록에 반영된다.

   날짜 칸에 보이는 라벨을 붙인 이유: md 미만에서는 두 칸이 세로로 쌓이는데,
   그때 설계서의 "[시작] ~ [종료]" 물결표가 두 칸 사이에서 혼자 한 줄을 먹고
   어느 칸이 시작인지도 사라진다. 라벨은 그 두 문제를 한 번에 없앤다. */

const BASIS: { key: ListRange["basis"]; label: string }[] = [
  { key: "usage", label: "사용일" },
  { key: "created", label: "신청일" },
];

export default function PeriodRange({
  range,
  onChange,
}: {
  range: ListRange;
  onChange: (next: ListRange) => void;
}) {
  const groupName = useId();
  const fromId = useId();
  const toId = useId();
  const hintId = useId();

  const from = range.from ?? "";
  const to = range.to ?? "";
  // 뒤집힌 구간은 결과가 0건이 되는데, 빈 목록만 보면 이유를 알 수 없다 — 여기서 먼저 말해준다.
  const inverted = !!from && !!to && from > to;

  /** 빈 문자열은 키에서 아예 뺀다 — 서버로 나가는 listFilters에 빈 날짜가 실리지 않게 */
  const setDate = (key: "from" | "to", value: string) => {
    const next: ListRange = { ...range };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-2">
        <fieldset className="flex flex-wrap items-center gap-x-4">
          <legend className="sr-only">기간 기준</legend>
          <span className="whitespace-nowrap text-xs text-gray-600">기준</span>
          {BASIS.map((b) => (
            <label key={b.key} className="flex h-11 items-center gap-2 whitespace-nowrap text-sm text-brown">
              <input
                type="radio"
                name={groupName}
                value={b.key}
                checked={range.basis === b.key}
                onChange={() => onChange({ ...range, basis: b.key })}
                className="h-4 w-4 accent-orange-dark"
              />
              {b.label}
            </label>
          ))}
        </fieldset>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor={fromId} className="w-7 shrink-0 whitespace-nowrap text-xs text-gray-600">
              시작
            </label>
            <input
              id={fromId}
              type="date"
              value={from}
              onChange={(e) => setDate("from", e.target.value)}
              aria-describedby={hintId}
              className={`${FIELD} min-w-0 flex-1 tabular-nums sm:w-40 sm:flex-none`}
            />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor={toId} className="w-7 shrink-0 whitespace-nowrap text-xs text-gray-600">
              종료
            </label>
            <input
              id={toId}
              type="date"
              value={to}
              onChange={(e) => setDate("to", e.target.value)}
              aria-describedby={hintId}
              className={`${FIELD} min-w-0 flex-1 tabular-nums sm:w-40 sm:flex-none`}
            />
          </div>
        </div>

        <p id={hintId} className="text-xs leading-5 break-keep text-gray-700">
          (양쪽 포함) 한쪽만 넣어도 돼요. 사용일은 스테이 체크인 · 살롱 일시이고, 날짜를 읽을 수 없는 행은 빠져요.
        </p>
      </div>

      <div aria-live="polite">
        {inverted && (
          <p className="mt-1.5 text-xs leading-5 break-keep text-brown">
            시작일이 종료일보다 늦어요. 두 날짜를 바꿔주세요.
          </p>
        )}
      </div>
    </div>
  );
}
