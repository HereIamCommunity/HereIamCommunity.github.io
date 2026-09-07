"use client";

import RowActions from "./RowActions";
import StatusBadge, { TypeBadge } from "./StatusBadge";
import {
  CARD_FLUSH,
  TD_CELL,
  TH_CELL,
  amountText,
  bookingStatus,
  contentOf,
  rowKey,
  whenOf,
  type AdminActions,
  type Row,
} from "./shared";

const HEADS = ["이름", "구분", "내용", "일시", "금액", "상태", "처리"];

/**
 * md 이상 전용 표. 7열만 두고 나머지는 상세 시트로 보낸다.
 * 셀은 전부 nowrap이고, 넘치는 건 이 래퍼 안에서만 가로 스크롤한다.
 */
export default function BookingTable({
  rows,
  actions,
  onSelect,
}: {
  rows: Row[];
  actions: AdminActions;
  onSelect: (row: Row) => void;
}) {
  return (
    <div className={`${CARD_FLUSH} overflow-x-auto`}>
      <table className="w-full min-w-[880px] text-sm">
        <caption className="sr-only">예약 목록 — 이름을 누르면 상세 정보가 열립니다.</caption>
        <thead>
          <tr className="border-b border-gray-200 bg-cream/50">
            {HEADS.map((h) => (
              <th
                key={h}
                scope="col"
                className={`${TH_CELL} text-left ${h === "이름" ? "sticky left-0 z-10 bg-cream" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const status = bookingStatus(row);
            return (
              <tr key={`${rowKey("booking", row)}-${i}`} className="border-b border-gray-100 last:border-0">
                <td className={`${TD_CELL} sticky left-0 z-10 bg-white`}>
                  <button
                    type="button"
                    onClick={() => onSelect(row)}
                    aria-label={`${row[2] || "이름 없음"} 상세 보기`}
                    className="whitespace-nowrap font-medium text-brown underline decoration-gray-300 underline-offset-4 hover:decoration-orange"
                  >
                    {row[2] || "이름 없음"}
                  </button>
                </td>
                <td className={TD_CELL}>
                  <TypeBadge type={row[1]} />
                </td>
                <td className={`${TD_CELL} max-w-[220px] overflow-hidden text-ellipsis text-brown`}>
                  {contentOf(row)}
                </td>
                <td className={`${TD_CELL} text-gray-700`}>{whenOf(row)}</td>
                <td className={`${TD_CELL} text-right tabular-nums text-brown`}>
                  {amountText(row[11])}
                </td>
                <td className={TD_CELL}>
                  <StatusBadge status={status} />
                </td>
                <td className={`${TD_CELL} align-top`}>
                  <RowActions sheet="booking" row={row} status={status} actions={actions} size="sm" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
