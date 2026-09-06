"use client";

import { BTN_SMALL, parseNotifyCell, rowKey, type AdminActions, type Row } from "./shared";

const DOT: Record<string, string> = {
  sent: "bg-teal",
  failed: "bg-orange-dark",
  skipped: "bg-gray-400",
  none: "bg-gray-400",
};
const TEXT: Record<string, string> = {
  sent: "text-teal-dark",
  failed: "text-brown font-medium",
  skipped: "text-gray-600",
  none: "text-gray-600",
};

/**
 * O열(알림) 상태. 취소 행도 그대로 보여준다.
 * ⏭(템플릿 미설정)는 재발송해도 또 건너뛰므로 버튼을 숨긴다.
 */
export default function NotifyStatus({ row, actions }: { row: Row; actions: AdminActions }) {
  const { kind, text } = parseNotifyCell(row[14]);
  const key = rowKey("booking", row);
  const busy = actions.busyKey === key;
  const canResend = kind === "failed" || kind === "none";

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[kind]}`} />
        <span className={`text-xs whitespace-nowrap ${TEXT[kind]}`}>{text}</span>
      </span>
      {canResend && (
        <button
          type="button"
          onClick={() => actions.resend(row)}
          disabled={busy}
          className={`${BTN_SMALL} border-orange-dark bg-orange/10 text-brown hover:bg-orange/20`}
        >
          {busy ? "처리중…" : "재발송"}
        </button>
      )}
    </span>
  );
}
