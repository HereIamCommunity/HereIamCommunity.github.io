"use client";

import { useCallback, useState } from "react";
import ConfirmCancelDialog from "./ConfirmCancelDialog";
import {
  BTN_CONFIRM,
  BTN_DANGER,
  BTN_OUTLINE,
  BTN_SMALL,
  amountText,
  contentOf,
  rowKey,
  whenOf,
  type AdminActions,
  type Row,
  type SheetKind,
} from "./shared";

function cancelLines(sheet: SheetKind, row: Row): string[] {
  if (sheet === "booking") {
    return [
      `${row[2] || "이름 없음"} · ${row[1] || "살롱"} ${contentOf(row)}`,
      `${whenOf(row)} · ${amountText(row[11])}`,
      row[3] ? `연락처 ${row[3]}` : "",
    ].filter(Boolean);
  }
  if (sheet === "retreat") {
    return [`${row[1] || "이름 없음"} · ${row[5] || "회차 미정"}`, row[2] ? `연락처 ${row[2]}` : ""].filter(Boolean);
  }
  return [
    `${row[1] || "이름 없음"} · 무료개방`,
    row[4] && row[5] ? `${row[4]} → ${row[5]}` : "",
    row[2] ? `연락처 ${row[2]}` : "",
  ].filter(Boolean);
}

const NOTICE: Record<SheetKind, string> = {
  booking: "게스트에게 취소 알림톡이 즉시 발송됩니다. 되돌리기는 이 행의 [되돌리기] 버튼으로 가능합니다.",
  retreat: "리트릿 신청은 알림이 발송되지 않습니다. 되돌리기는 이 행의 [되돌리기] 버튼으로 가능합니다.",
  open: "무료개방 신청은 알림이 발송되지 않습니다. 되돌리기는 이 행의 [되돌리기] 버튼으로 가능합니다.",
};

/**
 * 처리 중 버튼 스피너. 라벨은 그대로 두고 앞에만 붙여 버튼 폭이 흔들리지 않게 한다.
 * 텍스트가 아니라 장식이므로 aria-hidden — 진행 상황은 disabled + 결과 토스트가 알린다.
 */
export function Spinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none"
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 행 액션 3종 (입금확인/확정 · 취소 · 되돌리기).
 * 취소는 항상 확인 다이얼로그를 거친다.
 */
export default function RowActions({
  sheet,
  row,
  status,
  actions,
  size = "md",
  show = ["confirm", "cancel", "reopen"],
}: {
  sheet: SheetKind;
  row: Row;
  status: string;
  actions: AdminActions;
  size?: "sm" | "md";
  show?: ("confirm" | "cancel" | "reopen")[];
}) {
  const [asking, setAsking] = useState(false);
  const closeDialog = useCallback(() => setAsking(false), []);
  const key = rowKey(sheet, row);
  const busy = actions.busyKey === key;

  const s = (status ?? "").trim() || "신청";
  const isPendingRow = s === "신청";
  const isCancelled = s === "취소";
  const confirmLabel = sheet === "open" ? "확정" : "입금확인";

  const cls = (variant: "confirm" | "cancel" | "reopen") => {
    if (size === "sm") {
      const border =
        variant === "confirm"
          ? "border-teal text-teal-dark hover:bg-teal/10"
          : variant === "cancel"
          ? "border-orange-dark bg-orange/10 text-brown hover:bg-orange/20"
          : "border-gray-300 text-gray-700 hover:border-brown";
      return `${BTN_SMALL} ${border}`;
    }
    return variant === "confirm" ? BTN_CONFIRM : variant === "cancel" ? BTN_DANGER : BTN_OUTLINE;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPendingRow && show.includes("confirm") && (
        <button
          type="button"
          onClick={() => actions.changeStatus(sheet, row, "confirm")}
          disabled={busy}
          className={cls("confirm")}
        >
          {busy && <Spinner />}
          {confirmLabel}
        </button>
      )}
      {!isCancelled && show.includes("cancel") && (
        <button type="button" onClick={() => setAsking(true)} disabled={busy} className={cls("cancel")}>
          취소
        </button>
      )}
      {!isPendingRow && show.includes("reopen") && (
        <button
          type="button"
          onClick={() => actions.changeStatus(sheet, row, "reopen")}
          disabled={busy}
          className={cls("reopen")}
        >
          {busy && <Spinner />}
          되돌리기
        </button>
      )}

      {asking && (
        <ConfirmCancelDialog
          lines={cancelLines(sheet, row)}
          notice={NOTICE[sheet]}
          askReason={sheet === "booking"}
          onClose={closeDialog}
          onConfirm={(reason) => {
            setAsking(false);
            actions.changeStatus(sheet, row, "cancel", reason || undefined);
          }}
        />
      )}
    </div>
  );
}
