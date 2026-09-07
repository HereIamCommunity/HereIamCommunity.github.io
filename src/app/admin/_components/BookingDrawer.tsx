"use client";

import { useEffect, useRef } from "react";
import NotifyStatus from "./NotifyStatus";
import RowActions from "./RowActions";
import StatusBadge, { TypeBadge } from "./StatusBadge";
import {
  BTN_OUTLINE,
  amountText,
  bookingStatus,
  contentOf,
  shortDate,
  telHref,
  whenOf,
  type AdminActions,
  type Row,
} from "./shared";

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-gray-100 py-2.5">
      <dt className="w-20 shrink-0 whitespace-nowrap text-xs text-gray-600">{label}</dt>
      <dd className="min-w-0 flex-1 break-keep text-sm text-brown">{children}</dd>
    </div>
  );
}

/** 표에서 뺀 열(연락처·요청사항·알림·신청일시 등)을 담는 우측 상세 시트 */
export default function BookingDrawer({
  row,
  actions,
  onClose,
}: {
  row: Row | null;
  actions: AdminActions;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!row) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  if (!row) return null;
  const status = bookingStatus(row);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-brown/30">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-drawer-title"
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-gray-200 bg-white"
      >
        <div className="flex items-start gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="booking-drawer-title" className="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-medium text-brown">
              {row[2] || "이름 없음"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TypeBadge type={row[1]} />
              <StatusBadge status={status} />
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`${BTN_OUTLINE} shrink-0`}
          >
            닫기
          </button>
        </div>

        <dl className="px-5 py-2">
          <Line label="신청일시">
            <span className="break-keep">{row[0] || "—"}</span>
          </Line>
          <Line label="연락처">
            {row[3] ? (
              <a href={telHref(row[3])} className="whitespace-nowrap text-teal-dark underline">
                {row[3]}
              </a>
            ) : (
              "—"
            )}
          </Line>
          <Line label="내용">{contentOf(row)}</Line>
          <Line label="일시">{whenOf(row)}</Line>
          {row[1] === "스테이" && (
            <Line label="체크인/아웃">
              <span className="whitespace-nowrap">
                {row[8] ? shortDate(row[8]) : "—"} → {row[9] ? shortDate(row[9]) : "—"}
                {row[7] ? ` · ${row[7]}박` : ""}
              </span>
            </Line>
          )}
          <Line label="할인">{row[10] && row[10] !== "없음" ? row[10] : "없음"}</Line>
          <Line label="금액">
            <span className="whitespace-nowrap tabular-nums">{amountText(row[11])}</span>
          </Line>
          <Line label="알림">
            <NotifyStatus row={row} actions={actions} />
          </Line>
          <Line label="요청사항">{row[12] || "없음"}</Line>
        </dl>

        <div className="mt-auto border-t border-gray-200 px-5 py-4">
          <RowActions sheet="booking" row={row} status={status} actions={actions} />
        </div>
      </aside>
    </div>
  );
}
