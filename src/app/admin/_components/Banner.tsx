export type BannerTone = "warn" | "error" | "ok" | "info";

const TONE: Record<BannerTone, string> = {
  warn: "bg-orange/10 border-orange/40 text-brown",
  error: "bg-orange/15 border-orange-dark text-brown",
  ok: "bg-teal/10 border-teal/30 text-teal-dark",
  info: "bg-cream border-orange/25 text-brown",
};

/**
 * 화면 상단 알림 배너.
 * error는 role="alert"(즉시 읽힘), 나머지는 aria-live="polite".
 */
export default function Banner({
  tone,
  title,
  detail,
  action,
  onDismiss,
}: {
  tone: BannerTone;
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      aria-live={tone === "error" ? undefined : "polite"}
      className={`rounded-xl border p-4 md:p-5 ${TONE[tone]}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-keep">{title}</p>
          {detail && <p className="mt-1 text-xs leading-5 break-keep opacity-90">{detail}</p>}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-current px-4 text-sm font-medium hover:bg-white/50"
          >
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-11 shrink-0 items-center whitespace-nowrap px-2 text-xs underline"
          >
            닫기
          </button>
        )}
      </div>
    </div>
  );
}
