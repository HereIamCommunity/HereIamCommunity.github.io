"use client";

import { useCallback, useId, useMemo, useState } from "react";
import BookingDrawer from "./BookingDrawer";
import BookingList from "./BookingList";
import BulkPanel from "./BulkPanel";
import FilterGroup from "./FilterChips";
import PeriodRange from "./PeriodRange";
import type { ToastInput } from "./Toast";
import type { ApiResult } from "./useAdminApi";
import {
  BTN_OUTLINE,
  CARD_EMPTY,
  CARD_FLUSH,
  filterBookings,
  type AdminActions,
  type ListFilters,
  type ListRange,
  type Period,
  type Row,
  type StatusFilter,
  type TypeFilter,
} from "./shared";

const PERIODS: Period[] = ["오늘", "이번 주", "이번 달", "전체", "기간설정"];
const TYPES: TypeFilter[] = ["전체", "살롱", "스테이"];
const STATUSES: StatusFilter[] = ["전체", "입금대기", "확정", "취소"];

/** 기간설정 칩을 처음 눌렀을 때의 기준 (AdminShell의 DEFAULT_FILTERS.range와 같아야 한다) */
const DEFAULT_RANGE: ListRange = { basis: "usage" };

/**
 * 목록 탭 — 필터 칩 + 일괄 처리 패널 + 리스트(모바일 행 / 데스크톱 표) + 상세 시트.
 * 검색창과 결과 건수는 6.4에서 고정 헤더의 전역 검색으로 옮겼다. 여기서는 칩만 남는다.
 */
export default function ListTab({
  rows,
  actions,
  todayISO,
  loading,
  filters,
  onFiltersChange,
  apiFetch,
  push,
  onRefresh,
}: {
  rows: Row[];
  actions: AdminActions;
  todayISO: string;
  loading: boolean;
  filters: ListFilters;
  onFiltersChange: (next: ListFilters) => void;
  apiFetch: (path: string, init?: RequestInit) => Promise<ApiResult>;
  push: (t: ToastInput) => void;
  /** 일괄 처리·되돌리기 뒤 목록 재조회 */
  onRefresh: () => void;
}) {
  const { period, typeFilter, statusFilter } = filters;
  const set = <K extends keyof ListFilters>(key: K, value: ListFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const [selected, setSelected] = useState<Row | null>(null);
  const closeDrawer = useCallback(() => setSelected(null), []);

  // 일괄 처리는 매일 쓰는 기능이 아니라 접어 둔다 — 칩 옆에 문 하나만 두고, 열면 그 아래로 펼친다.
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkId = useId();

  const filtered = useMemo(() => filterBookings(rows, filters, todayISO), [rows, filters, todayISO]);

  return (
    <div className="space-y-5">
      {/* 칩 오른쪽에 [일괄 처리] — md 미만에서는 칩 아래로 내려간다 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0 flex-1 space-y-2.5">
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
          {/* 기간설정을 고른 동안만 칩 바로 아래 한 줄 — 값이 바뀌면 목록·상단 "N건"이 같이 움직인다 */}
          {period === "기간설정" && (
            <PeriodRange range={filters.range ?? DEFAULT_RANGE} onChange={(next) => set("range", next)} />
          )}
        </div>

        <button
          type="button"
          onClick={() => setBulkOpen((v) => !v)}
          aria-expanded={bulkOpen}
          aria-controls={bulkId}
          className={`${BTN_OUTLINE} shrink-0 self-start`}
        >
          {bulkOpen ? "일괄 처리 닫기" : "일괄 처리"}
        </button>
      </div>

      {bulkOpen && (
        <div id={bulkId}>
          <BulkPanel
            apiFetch={apiFetch}
            push={push}
            onDone={onRefresh}
            todayISO={todayISO}
            listFilters={filters}
            listCount={filtered.length}
          />
        </div>
      )}

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
