"use client";

import { CARD, CARD_STACK, STAT_LABEL, STAT_VALUE } from "./shared";

export type CardTone = "brown" | "orange" | "teal" | "gray";

// 값 글자는 대비 4.5:1 이상만 쓴다(orange 계열은 흰 배경에서 3.6:1이라 제외).
// 카테고리 구분은 라벨 옆 색 점이 맡는다.
const VALUE_TONE: Record<CardTone, string> = {
  brown: "text-brown",
  orange: "text-brown",
  teal: "text-teal-dark",
  gray: "text-gray-700",
};
const DOT_TONE: Record<CardTone, string> = {
  brown: "bg-brown",
  orange: "bg-orange-dark",
  teal: "bg-teal",
  gray: "bg-gray-400",
};

/**
 * 요약 숫자 카드. 한 줄에 놓인 카드끼리 높이가 같도록 CARD_STACK + 값에 mt-auto.
 * 값은 nowrap이라 좁은 화면에서도 세로로 깨지지 않고, 넘치면 말줄임으로 끊는다.
 */
export default function SummaryCard({
  label,
  value,
  tone = "brown",
  onClick,
}: {
  label: string;
  value: string;
  tone?: CardTone;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className={`${STAT_LABEL} mb-2 flex items-center gap-1.5`}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[tone]}`} />
        {label}
      </p>
      <p className={`${STAT_VALUE} mt-auto ${VALUE_TONE[tone]}`}>{value}</p>
    </>
  );

  const box = `${CARD} ${CARD_STACK} min-w-0 text-left`;
  if (!onClick) return <div className={box}>{body}</div>;

  return (
    <button type="button" onClick={onClick} className={`${box} hover:border-brown`}>
      {body}
    </button>
  );
}
