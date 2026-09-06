"use client";

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
 * 요약 숫자 카드. 360px에서도 라벨·값이 한 줄로 유지되도록
 * 라벨은 whitespace-nowrap, 값은 nowrap + 넘치면 말줄임(줄바꿈 대신).
 */
export default function SummaryCard({
  label,
  value,
  tone = "brown",
  onClick,
  active = false,
}: {
  label: string;
  value: string;
  tone?: CardTone;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <p className="mb-1 flex items-center gap-1.5 whitespace-nowrap text-xs text-gray-700">
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[tone]}`} />
        {label}
      </p>
      <p
        className={`overflow-hidden text-ellipsis whitespace-nowrap text-lg font-medium tabular-nums ${VALUE_TONE[tone]}`}
      >
        {value}
      </p>
    </>
  );

  const box = `min-w-0 rounded-xl border bg-white px-4 py-3 text-left ${
    active ? "border-orange" : "border-gray-200"
  }`;

  if (!onClick) return <div className={box}>{body}</div>;

  return (
    <button type="button" onClick={onClick} className={`${box} min-h-[72px] hover:border-brown`}>
      {body}
    </button>
  );
}
