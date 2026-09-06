"use client";

import { RETREAT_CAPACITY, RETREAT_SESSIONS } from "@/lib/retreat-sessions";
import EntryCard from "./EntryCard";
import RowActions from "./RowActions";
import StatusBadge from "./StatusBadge";
import SummaryCard from "./SummaryCard";
import { retreatStatus, rowKey, shortDateTime, type AdminActions, type Row } from "./shared";

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
        <h2 id="retreat-counts-h" className="whitespace-nowrap text-sm font-medium text-brown">
          회차별 인원 (취소 제외)
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
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
        <ul className="grid gap-2 md:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => (
            <li key={i} className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />
          ))}
        </ul>
      ) : retreats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-brown">아직 리트릿 신청이 없어요</p>
          <p className="mt-1.5 text-xs leading-5 break-keep text-gray-700">
            신청이 들어오면 여기에서 회차별 인원과 함께 확인할 수 있어요.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {retreats.map((row, i) => {
            const status = retreatStatus(row);
            return (
              <EntryCard
                key={`${rowKey("retreat", row)}-${i}`}
                title={row[1] || "이름 없음"}
                badge={<StatusBadge status={status} />}
                message={actions.rowMsg[rowKey("retreat", row)]}
                fields={[
                  { label: "회차", value: row[5] },
                  { label: "학년", value: row[3] },
                  { label: "지역", value: row[4] },
                  { label: "연락처", value: row[2], tel: true },
                ]}
                details={[
                  { label: "신청일시", value: shortDateTime(row[0]) },
                  { label: "추천인", value: row[6] },
                  { label: "궁금한점", value: row[7] },
                  { label: "요청사항", value: row[8] },
                  { label: "알레르기", value: row[9] },
                  { label: "케어사항", value: row[10] },
                  { label: "부모님", value: row[11] },
                ]}
                actions={
                  <RowActions sheet="retreat" row={row} status={status} actions={actions} size="sm" hideMsg />
                }
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
