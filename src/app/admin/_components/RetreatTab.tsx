"use client";

import { RETREAT_CAPACITY, RETREAT_SESSIONS } from "@/lib/retreat-sessions";
import EntryList, { TelCell } from "./EntryList";
import RowActions from "./RowActions";
import StatusBadge from "./StatusBadge";
import SummaryCard from "./SummaryCard";
import {
  CARD_EMPTY,
  CARD_FLUSH,
  CARD_GRID,
  SECTION_H,
  createdShort,
  retreatStatus,
  rowKey,
  type AdminActions,
  type Row,
} from "./shared";

/** 리트릿 탭 — 회차별 인원(취소 제외) + 신청 목록 + 상태 처리 */
export default function RetreatTab({
  retreats,
  counts,
  actions,
  loading,
}: {
  retreats: Row[];
  counts: Record<string, number>;
  actions: AdminActions;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="retreat-counts-h" className="space-y-2">
        <h2 id="retreat-counts-h" className={SECTION_H}>
          회차별 인원 (취소 제외)
        </h2>
        <div className={`${CARD_GRID} grid-cols-2 md:grid-cols-5`}>
          {RETREAT_SESSIONS.map((s) => {
            const n = counts[s.key] ?? counts[s.label] ?? 0;
            return (
              <SummaryCard
                key={s.key}
                label={s.label}
                value={`${n}/${RETREAT_CAPACITY}${n >= RETREAT_CAPACITY ? " 마감" : ""}`}
                tone={n >= RETREAT_CAPACITY ? "orange" : "brown"}
              />
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className={`${CARD_FLUSH} h-64 animate-pulse`} aria-busy="true" />
      ) : retreats.length === 0 ? (
        <div className={CARD_EMPTY}>
          <p className="text-sm font-medium text-brown">아직 리트릿 신청이 없어요</p>
          <p className="mt-1.5 text-xs leading-5 break-keep text-gray-700">
            신청이 들어오면 여기에서 회차별 인원과 함께 확인할 수 있어요.
          </p>
        </div>
      ) : (
        <EntryList
          caption="리트릿 신청 목록 — [상세]를 누르면 추천인·요청사항 등을 볼 수 있습니다."
          heads={["신청일", "이름", "회차", "학년", "지역", "연락처", "상태", "처리"]}
          items={retreats.map((row) => {
            const status = retreatStatus(row);
            const id = rowKey("retreat", row);
            return {
              id,
              name: row[1] || "이름 없음",
              badge: <StatusBadge status={status} />,
              busy: actions.busyKey === id,
              failed: actions.errorKey === id,
              cells: [
                createdShort(row[0]),
                row[1] || "이름 없음",
                row[5] || "—",
                row[3] || "—",
                row[4] || "—",
                <TelCell key="tel" phone={row[2]} />,
                <StatusBadge key="st" status={status} />,
              ],
              meta: [
                createdShort(row[0]),
                row[5] || "회차 미정",
                `${row[3] || "?"} · ${row[4] || "지역 미기재"}`,
                <TelCell key="tel" phone={row[2]} />,
              ],
              actions: <RowActions sheet="retreat" row={row} status={status} actions={actions} size="sm" />,
              details: [
                { label: "추천인", value: row[6] },
                { label: "궁금한점", value: row[7] },
                { label: "요청사항", value: row[8] },
                { label: "알레르기", value: row[9] },
                { label: "케어사항", value: row[10] },
                { label: "부모님", value: row[11] },
              ],
            };
          })}
        />
      )}
    </div>
  );
}
