"use client";

import { useCallback, useMemo, useState } from "react";
import BookingDrawer from "./BookingDrawer";
import BookingList from "./BookingList";
import FilterGroup from "./FilterChips";
import {
  CARD_EMPTY,
  CARD_FLUSH,
  filterBookings,
  type AdminActions,
  type ListFilters,
  type Period,
  type Row,
  type StatusFilter,
  type TypeFilter,
} from "./shared";

const PERIODS: Period[] = ["오늘", "이번 주", "이번 달", "전체"];
const TYPES: TypeFilter[] = ["전체", "살롱", "스테이"];
const STATUSES: StatusFilter[] = ["전체", "입금대기", "확정", "취소"];

/**
 * 목록 탭 — 필터 칩 + 리스트(모바일 행 / 데스크톱 표) + 상세 시트.
 * 검색창과 결과 건수는 6.4에서 고정 헤더의 전역 검색으로 옮겼다. 여기서는 칩만 남는다.
 */
export default function ListTab({
  rows,
  actions,
  todayISO,
  loading,
  filters,
  onFiltersChange,
}: {
  rows: Row[];
  actions: AdminActions;
  todayISO: string;
  loading: boolean;
  filters: ListFilters;
  onFiltersChange: (next: ListFilters) => void;
}) {
  const { period, typeFilter, statusFilter } = filters;
  const set = <K extends keyof ListFilters>(key: K, value: ListFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const [selected, setSelected] = useState<Row | null>(null);
  const closeDrawer = useCallback(() => setSelected(null), []);

  const filtered = useMemo(() => filterBookings(rows, filters, todayISO), [rows, filters, todayISO]);

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <FilterGroup
          legend="구분"
          options={TYPES}
          value={typeFilter}
          onChange={(v) => set("typeFilter", v as TypeFilter)}
        />
        <FilterGroup
          legend="상태"
          options={STATUSES}
          value={statusFilter}
          onChange={(v) => set("statusFilter", v as StatusFilter)}
        />
        <FilterGroup
          legend="기간"
          options={PERIODS}
          value={period}
          onChange={(v) => set("period", v as Period)}
        />
      </div>

      {loading ? (
        <div className={`${CARD_FLUSH} h-64 animate-pulse`} aria-busy="true" />
      ) : filtered.length === 0 ? (
        <div className={CARD_EMPTY}>
          <p className="text-sm font-medium text-brown">조건에 맞는 신청이 없어요</p>
          <p className="mt-1.5 text-xs leading-5 break-keep text-gray-700">
            필터를 &lsquo;전체&rsquo;로 되돌리거나 위쪽 검색어를 지우면 전체 신청을 볼 수 있어요.
          </p>
        </div>
      ) : (
        <BookingList rows={filtered} actions={actions} onSelect={setSelected} />
      )}

      <BookingDrawer row={selected} actions={actions} onClose={closeDrawer} />
    </div>
  );
}
