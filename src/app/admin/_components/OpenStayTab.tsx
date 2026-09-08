"use client";

import { isConfirmed, isPending } from "@/lib/digest";
import EntryList, { TelCell } from "./EntryList";
import RowActions from "./RowActions";
import StatusBadge from "./StatusBadge";
import SummaryCard from "./SummaryCard";
import {
  CARD_EMPTY,
  CARD_FLUSH,
  CARD_GRID,
  createdShort,
  openStayStatus,
  rowKey,
  shortDate,
  type AdminActions,
  type Row,
} from "./shared";

/** 무료개방 탭 — 신청 검토 + 확정/취소/되돌리기 */
export default function OpenStayTab({
  openStays,
  actions,
  loading,
}: {
  openStays: Row[];
  actions: AdminActions;
  loading: boolean;
}) {
  const confirmed = openStays.filter((r) => isConfirmed(openStayStatus(r))).length;
  const reviewing = openStays.filter((r) => isPending(openStayStatus(r))).length;
  const cancelled = openStays.filter((r) => openStayStatus(r) === "취소").length;

  return (
    <div className="space-y-6">
      <div className={`${CARD_GRID} grid-cols-2 md:grid-cols-4`}>
        <SummaryCard label="전체 신청" value={`${openStays.length}건`} />
        <SummaryCard label="확정" value={`${confirmed}건`} tone="teal" />
        <SummaryCard label="검토 중" value={`${reviewing}건`} tone="orange" />
        <SummaryCard label="취소" value={`${cancelled}건`} tone="gray" />
      </div>

      {loading ? (
        <div className={`${CARD_FLUSH} h-64 animate-pulse`} aria-busy="true" />
      ) : openStays.length === 0 ? (
        <div className={CARD_EMPTY}>
          <p className="text-sm font-medium text-brown">아직 무료개방 신청이 없어요</p>
          <p className="mt-1.5 text-xs leading-5 break-keep text-gray-700">
            신청이 들어오면 여기에서 바로 확정하거나 취소할 수 있어요.
          </p>
        </div>
      ) : (
        <EntryList
          caption="무료개방 신청 목록 — [상세]를 누르면 방문이유·기여방법 등을 볼 수 있습니다."
          heads={["신청일", "이름", "일정", "형태", "연락처", "상태", "처리"]}
          items={openStays.map((row) => {
            const status = openStayStatus(row);
            const id = rowKey("open", row);
            const schedule = row[4] && row[5] ? `${shortDate(row[4])} → ${shortDate(row[5])}` : "—";
            const shape = row[6] ? `${row[6]} · ${row[7] || "?"}명` : "—";
            return {
              id,
              name: row[1] || "이름 없음",
              badge: <StatusBadge status={status} />,
              busy: actions.busyKey === id,
              failed: actions.errorKey === id,
              cells: [
                createdShort(row[0]),
                row[1] || "이름 없음",
                schedule,
                shape,
                <TelCell key="tel" phone={row[2]} />,
                <StatusBadge key="st" status={status} />,
              ],
              meta: [createdShort(row[0]), schedule, shape, <TelCell key="tel" phone={row[2]} />],
              actions: <RowActions sheet="open" row={row} status={status} actions={actions} size="sm" />,
              details: [
                { label: "이메일", value: row[3] },
                { label: "방문이유", value: row[8] },
                { label: "기여방법", value: row[9] },
                { label: "응원", value: row[10] },
              ],
            };
          })}
        />
      )}
    </div>
  );
}
