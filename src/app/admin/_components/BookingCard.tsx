"use client";

import { useId, useState } from "react";
import NotifyStatus from "./NotifyStatus";
import RowActions from "./RowActions";
import StatusBadge, { TypeBadge } from "./StatusBadge";
import {
  BTN_OUTLINE,
  CARD,
  CARD_STACK,
  amountText,
  bookingStatus,
  contentOf,
  rowKey,
  shortDateTime,
  telHref,
  whenOf,
  type AdminActions,
  type Row,
} from "./shared";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-14 shrink-0 whitespace-nowrap text-xs text-gray-600">{label}</span>
      <span className="min-w-0 flex-1 break-keep text-sm text-brown">{children}</span>
    </div>
  );
}

/** md 미만에서 표 대신 쓰는 예약 카드. 파괴적 액션은 [더보기] 안으로 접어 둔다. */
export default function BookingCard({ row, actions }: { row: Row; actions: AdminActions }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const status = bookingStatus(row);
  const key = rowKey("booking", row);
  const msg = actions.rowMsg[key];

  return (
    <li className={`${CARD} ${CARD_STACK}`}>
      <div className="mb-3 flex items-start gap-2">
        <p className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-medium text-brown">
          {row[2] || "이름 없음"}
        </p>
        <span className="shrink-0">
          <StatusBadge status={status} />
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <TypeBadge type={row[1]} />
          <span className="min-w-0 flex-1 break-keep text-sm text-brown">{contentOf(row)}</span>
        </div>
        <Field label="일시">{whenOf(row)}</Field>
        <Field label="금액">
          <span className="whitespace-nowrap tabular-nums">{amountText(row[11])}</span>
        </Field>
        <Field label="연락처">
          {row[3] ? (
            <a href={telHref(row[3])} className="whitespace-nowrap text-teal-dark underline">
              {row[3]}
            </a>
          ) : (
            "—"
          )}
        </Field>
        <Field label="알림">
          <NotifyStatus row={row} actions={actions} />
        </Field>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-3">
        <div className="min-w-0 flex-1">
          <RowActions sheet="booking" row={row} status={status} actions={actions} show={["confirm"]} hideMsg />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailId}
          className={`${BTN_OUTLINE} shrink-0`}
        >
          {open ? "접기" : "더보기"}
        </button>
      </div>

      {msg && (
        <p
          aria-live="polite"
          className={`mt-2 min-w-0 break-keep text-xs leading-4 ${msg.ok ? "text-teal-dark" : "text-brown"}`}
        >
          {msg.text}
        </p>
      )}

      {open && (
        <div id={detailId} className="mt-3 space-y-2 border-t border-gray-200 pt-3">
          <Field label="신청일시">
            <span className="whitespace-nowrap">{shortDateTime(row[0])}</span>
          </Field>
          <Field label="할인">{row[10] && row[10] !== "없음" ? row[10] : "없음"}</Field>
          <Field label="요청사항">{row[12] || "없음"}</Field>
          <RowActions
            sheet="booking"
            row={row}
            status={status}
            actions={actions}
            show={["cancel", "reopen"]}
            hideMsg
          />
        </div>
      )}
    </li>
  );
}
