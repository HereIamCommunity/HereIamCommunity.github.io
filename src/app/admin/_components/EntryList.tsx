"use client";

import { Fragment, useCallback, useState } from "react";
import {
  BTN_SMALL,
  CARD_FLUSH,
  LIST_ROW,
  ROW_BUSY,
  ROW_FAILED,
  STICKY_L,
  STICKY_R,
  TD_CELL,
  TH_CELL,
  cellBg,
  telHref,
} from "./shared";

/* ── 리트릿·무료개방 리스트형 (6.3) ──────────────────────────
   자유 서술 열이 많아 표로 다 펼치면 셀이 밀려나므로, 짧은 값만 행에 두고
   나머지는 [상세] 토글로 편다. 예약 목록과 같은 규칙: 카드 없음, 구분선만,
   md 이상은 표(신청일·이름 왼쪽 고정 · 처리 오른쪽 고정). */

export type EntryDetail = { label: string; value: string };

export type EntryItem = {
  /** 행 식별 키 (busy·실패 강조 판정에 그대로 쓴다) */
  id: string;
  name: string;
  badge: React.ReactNode;
  /** 표 셀 — heads에서 마지막 "처리"를 뺀 순서. 0=신청일, 1=이름 자리(EntryList가 그린다) */
  cells: React.ReactNode[];
  /** md 미만 2줄에 들어가는 짧은 값들 */
  meta: React.ReactNode[];
  actions: React.ReactNode;
  details: EntryDetail[];
  busy: boolean;
  failed: boolean;
};

/** 연락처 셀 — 값이 없으면 "—" */
export function TelCell({ phone }: { phone: string }) {
  if (!phone) return <span className="text-gray-500">—</span>;
  return (
    <a href={telHref(phone)} className="whitespace-nowrap text-teal-dark underline underline-offset-4">
      {phone}
    </a>
  );
}

const CREATED_W = "w-[92px] min-w-[92px]";
const NAME_L = "left-[92px]";

function DetailList({ details }: { details: EntryDetail[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {details.map((d) => (
        <div key={d.label} className="flex items-baseline gap-3">
          <dt className="w-16 shrink-0 whitespace-nowrap text-xs text-gray-600">{d.label}</dt>
          <dd className="min-w-0 flex-1 break-keep text-sm text-brown">{d.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailToggle({ open, onClick, id }: { open: boolean; onClick: () => void; id: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={id}
      className={`${BTN_SMALL} border-gray-300 text-gray-700 hover:border-brown`}
    >
      {open ? "접기" : "상세"}
    </button>
  );
}

/**
 * 리트릿·무료개방 공용 리스트.
 * `heads`의 마지막 항목은 "처리"이고, `item.cells`는 그 앞까지의 셀이다.
 */
export default function EntryList({
  heads,
  items,
  caption,
}: {
  heads: string[];
  items: EntryItem[];
  caption: string;
}) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const toggle = useCallback(
    (id: string) => setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    []
  );

  return (
    <>
      {/* md 미만 — 리스트 행 */}
      <ul className={`${CARD_FLUSH} md:hidden`}>
        {items.map((item, i) => {
          const open = openIds.includes(item.id);
          const panelId = `entry-m-${i}`;
          return (
            <li
              key={`${item.id}-m-${i}`}
              className={`${LIST_ROW} ${item.busy ? ROW_BUSY : ""} ${item.failed ? ROW_FAILED : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-brown">
                  {item.name}
                </span>
                <span className="shrink-0">{item.badge}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-700">
                {item.meta.map((m, j) => (
                  <span key={j} className="whitespace-nowrap">
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.actions}
                <DetailToggle open={open} onClick={() => toggle(item.id)} id={panelId} />
              </div>
              {open && (
                <div id={panelId} className="mt-3 border-t border-gray-200 pt-3">
                  <DetailList details={item.details} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* md 이상 — 표 */}
      <div className={`${CARD_FLUSH} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[880px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-gray-200 bg-cream/50">
              {heads.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={`${TH_CELL} text-left ${
                    i === 0
                      ? `${STICKY_L} ${CREATED_W} bg-cream`
                      : i === 1
                        ? `sticky ${NAME_L} z-10 border-r border-gray-200 bg-cream`
                        : ""
                  } ${i === heads.length - 1 ? `${STICKY_R} border-l border-gray-200 bg-cream` : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const open = openIds.includes(item.id);
              const panelId = `entry-d-${i}`;
              return (
                <Fragment key={`${item.id}-d-${i}`}>
                  <tr
                    className={`border-b border-gray-100 ${item.busy ? ROW_BUSY : ""} ${
                      item.failed ? ROW_FAILED : ""
                    }`}
                  >
                    {item.cells.map((c, j) => (
                      <td
                        key={j}
                        className={`${TD_CELL} ${
                          j === 0
                            ? `${STICKY_L} ${CREATED_W} ${cellBg(item.failed)} tabular-nums text-gray-700`
                            : j === 1
                              ? `sticky ${NAME_L} z-10 border-r border-gray-200 ${cellBg(item.failed)} font-medium text-brown`
                              : "text-gray-700"
                        }`}
                      >
                        {c}
                      </td>
                    ))}
                    <td className={`${TD_CELL} ${STICKY_R} border-l border-gray-200 ${cellBg(item.failed)}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.actions}
                        <DetailToggle open={open} onClick={() => toggle(item.id)} id={panelId} />
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-gray-100 bg-cream/40">
                      <td id={panelId} colSpan={heads.length} className="px-4 py-3">
                        <DetailList details={item.details} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
