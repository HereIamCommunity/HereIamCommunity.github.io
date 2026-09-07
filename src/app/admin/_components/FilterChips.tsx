"use client";

/** 필터 칩 하나. 상태는 aria-pressed로 알린다(색만으로 전달 금지). */
export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[36px] whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors ${
        active ? "border-brown bg-brown text-white" : "border-gray-300 bg-white text-gray-700 hover:border-brown"
      }`}
    >
      {label}
    </button>
  );
}

/** 라벨 + 칩 한 줄. 목록 탭과 통계 탭이 같은 컨트롤을 쓴다. */
export default function FilterGroup({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
      <legend className="sr-only">{legend}</legend>
      <span className="whitespace-nowrap text-xs text-gray-600">{legend}</span>
      {options.map((o) => (
        <Chip key={o} label={o} active={value === o} onClick={() => onChange(o)} />
      ))}
    </fieldset>
  );
}
