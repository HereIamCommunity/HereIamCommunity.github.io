"use client";

import NotifyStatus from "./NotifyStatus";
import RowActions from "./RowActions";
import StatusBadge, { TypeBadge } from "./StatusBadge";
import {
  CARD_FLUSH,
  LIST_ROW,
  ROW_BUSY,
  ROW_FAILED,
  STICKY_L,
  STICKY_R,
  TD_CELL,
  TH_CELL,
  amountText,
  bookingStatus,
  cellBg,
  contentOf,
  createdShort,
  rowKey,
  telHref,
  whenOf,
  type AdminActions,
  type Row,
} from "./shared";

/* ── 예약 목록 리스트형 (6.3) ──────────────────────────────
   카드형은 한 화면에 3~4건밖에 못 담아서 "명단"으로 읽히지 않았다. 모든 폭에서
   한 행 = 한 예약이 되도록 md 이상은 표, md 미만은 구분선만 있는 리스트 행으로 간다.

   열 순서는 docs 6.3 그대로(신청일 먼저)이고, 가로 스크롤 중에도 어느 행인지 잃지 않도록
   신청일·이름 두 칸을 왼쪽에 함께 고정한다(이름만 고정하면 신청일 위로 겹쳐 그려진다).
   처리 열은 오른쪽 고정 — 스크롤 끝까지 가지 않아도 [입금확인]을 누를 수 있어야 한다. */

const HEADS = ["신청일", "이름", "구분", "내용", "일시", "금액", "연락처", "상태", "알림", "처리"];

/** 왼쪽 고정 2칸의 폭 — 헤더/본문이 같은 값을 써야 어긋나지 않는다 */
const CREATED_W = "w-[92px] min-w-[92px]";
const NAME_L = "left-[92px]";

function Tel({ phone }: { phone: string }) {
  if (!phone) return <span className="text-gray-500">—</span>;
  return (
    <a href={telHref(phone)} className="whitespace-nowrap text-teal-dark underline underline-offset-4">
      {phone}
    </a>
  );
}

/** md 이상 — 표 */
function DesktopTable({
  rows,
  actions,
  onSelect,
}: {
  rows: Row[];
  actions: AdminActions;
  onSelect: (row: Row) => void;
}) {
  return (
    <div className={`${CARD_FLUSH} hidden overflow-x-auto md:block`}>
      <table className="w-full min-w-[1080px] text-sm">
        <caption className="sr-only">예약 목록 — 이름을 누르면 상세 정보가 열립니다.</caption>
        <thead>
          <tr className="border-b border-gray-200 bg-cream/50">
            {HEADS.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`${TH_CELL} text-left ${
                  i === 0
                    ? `${STICKY_L} ${CREATED_W} bg-cream`
                    : i === 1
                      ? `sticky ${NAME_L} z-10 border-r border-gray-200 bg-cream`
                      : ""
                } ${h === "처리" ? `${STICKY_R} border-l border-gray-200 bg-cream` : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const status = bookingStatus(row);
            const id = rowKey("booking", row);
            const busy = actions.busyKey === id;
            const failed = actions.errorKey === id;
            return (
              <tr
                key={`${id}-${i}`}
                className={`border-b border-gray-100 last:border-0 ${busy ? ROW_BUSY : ""} ${
                  failed ? ROW_FAILED : ""
                }`}
              >
                <td className={`${TD_CELL} ${STICKY_L} ${CREATED_W} ${cellBg(failed)} tabular-nums text-gray-700`}>
                  {createdShort(row[0])}
                </td>
                <td className={`${TD_CELL} sticky ${NAME_L} z-10 border-r border-gray-200 ${cellBg(failed)}`}>
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
                <td className={`${TD_CELL} max-w-[180px] overflow-hidden text-ellipsis text-brown`}>
                  {contentOf(row)}
                </td>
                <td className={`${TD_CELL} text-gray-700`}>{whenOf(row)}</td>
                <td className={`${TD_CELL} text-right tabular-nums text-brown`}>{amountText(row[11])}</td>
                <td className={TD_CELL}>
                  <Tel phone={row[3]} />
                </td>
                <td className={TD_CELL}>
                  <StatusBadge status={status} />
                </td>
                {/* 알림 문구는 길이가 들쭉날쭉하다. 폭을 묶어 표 전체 폭이 데이터에 따라
                    늘어나지 않게 하고, 넘치면 말줄임 — 전문은 행 상세(drawer)에 있다. */}
                <td className={`${TD_CELL} max-w-[170px]`}>
                  <NotifyStatus row={row} actions={actions} compact />
                </td>
                <td className={`${TD_CELL} ${STICKY_R} border-l border-gray-200 ${cellBg(failed)}`}>
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

/**
 * md 미만 — 2~3줄 리스트 행.
 * 행 전체를 덮는 버튼으로 상세를 열고, 그 위에 연락처 링크·처리 버튼을 올린다.
 * (버튼 안에 버튼을 중첩하지 않으면서 "행 어디를 눌러도 상세"를 만드는 방법)
 */
function BookingRow({
  row,
  actions,
  onSelect,
}: {
  row: Row;
  actions: AdminActions;
  onSelect: (row: Row) => void;
}) {
  const status = bookingStatus(row);
  const key = rowKey("booking", row);
  const busy = actions.busyKey === key;
  const failed = actions.errorKey === key;

  return (
    <li className={`${LIST_ROW} ${busy ? ROW_BUSY : ""} ${failed ? ROW_FAILED : ""}`}>
      <button
        type="button"
        onClick={() => onSelect(row)}
        className="absolute inset-0 z-0 h-full w-full cursor-pointer"
      >
        <span className="sr-only">{row[2] || "이름 없음"} 상세 보기</span>
      </button>

      <div className="pointer-events-none relative z-10 flex items-baseline gap-2">
        <span className="shrink-0 whitespace-nowrap text-sm font-medium text-brown">
          {row[2] || "이름 없음"}
        </span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-700">
          {row[1] || "살롱"} · {contentOf(row)}
        </span>
        <span className="shrink-0">
          <StatusBadge status={status} />
        </span>
      </div>

      <div className="pointer-events-none relative z-10 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-700">
        <span className="whitespace-nowrap tabular-nums">{createdShort(row[0])}</span>
        <span aria-hidden="true" className="text-gray-300">
          ·
        </span>
        <span className="whitespace-nowrap">{whenOf(row)}</span>
        <span aria-hidden="true" className="text-gray-300">
          ·
        </span>
        <span className="whitespace-nowrap tabular-nums text-brown">{amountText(row[11])}</span>
        <span className="pointer-events-auto">
          <Tel phone={row[3]} />
        </span>
      </div>

      <div className="relative z-10 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <NotifyStatus row={row} actions={actions} />
        <RowActions sheet="booking" row={row} status={status} actions={actions} size="sm" />
      </div>
    </li>
  );
}

/** 예약 목록 — 목록 탭·오늘 탭 입금대기 섹션이 같은 컴포넌트를 쓴다 */
export default function BookingList({
  rows,
  actions,
  onSelect,
}: {
  rows: Row[];
  actions: AdminActions;
  onSelect: (row: Row) => void;
}) {
  return (
    <>
      <ul className={`${CARD_FLUSH} md:hidden`}>
        {rows.map((row, i) => (
          <BookingRow
            key={`${rowKey("booking", row)}-${i}`}
            row={row}
            actions={actions}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <DesktopTable rows={rows} actions={actions} onSelect={onSelect} />
    </>
  );
}
