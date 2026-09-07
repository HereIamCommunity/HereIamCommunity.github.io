"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isConfirmed, isPending, parseSheetDateTime } from "@/lib/digest";
import BookingCard from "./BookingCard";
import BookingDrawer from "./BookingDrawer";
import BookingTable from "./BookingTable";
import {
  bookingStatus,
  inPeriod,
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

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[36px] whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors ${
        active ? "border-brown bg-brown text-white" : "border-gray-300 bg-white text-gray-700 hover:border-brown"
      }`}
    >
      {label}
    </button>
  );
}

function FilterGroup({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
      <legend className="sr-only">{legend}</legend>
      <span className="whitespace-nowrap text-xs text-gray-600">{legend}</span>
      {options.map((o) => (
        <Chip key={o} label={o} active={value === o} onClick={() => onChange(o)} />
      ))}
    </fieldset>
  );
}

function matchStatus(status: string, filter: StatusFilter): boolean {
  if (filter === "전체") return true;
  if (filter === "취소") return status === "취소";
  if (filter === "확정") return isConfirmed(status);
  return isPending(status) || !status;
}

/** 목록 탭 — 필터·검색 + (모바일)카드/(데스크톱)표 + 상세 시트 */
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
  const { period, typeFilter, statusFilter, searchInput } = filters;
  const set = <K extends keyof ListFilters>(key: K, value: ListFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  // 검색어는 부모가 들고 있고, 디바운스된 값만 여기서 만든다.
  // 탭을 다시 열었을 때 200ms 동안 필터가 풀려 보이지 않게 초기값을 맞춰 둔다.
  const [search, setSearch] = useState(() => searchInput.trim());
  const [selected, setSelected] = useState<Row | null>(null);
  const closeDrawer = useCallback(() => setSelected(null), []);

  // 검색 디바운스 200ms
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filtered = useMemo(() => {
    const list = rows.filter((row) => {
      if (typeFilter !== "전체" && row[1] !== typeFilter) return false;
      if (!matchStatus(bookingStatus(row), statusFilter)) return false;
      if (!inPeriod(row[0], period, todayISO)) return false;
      if (!search) return true;
      return [row[2], row[3], row[4], row[6]].some((c) => (c ?? "").includes(search));
    });
    // 신청일시 내림차순 — 새 신청이 항상 맨 위
    return list.sort(
      (a, b) => (parseSheetDateTime(b[0])?.getTime() ?? 0) - (parseSheetDateTime(a[0])?.getTime() ?? 0)
    );
  }, [rows, typeFilter, statusFilter, period, search, todayISO]);

  return (
    <div className="space-y-4">
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="admin-search" className="sr-only">
            이름·연락처·프로그램 검색
          </label>
          <input
            id="admin-search"
            type="search"
            value={searchInput}
            onChange={(e) => set("searchInput", e.target.value)}
            placeholder="이름·연락처·프로그램 검색"
            className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-brown placeholder:text-gray-500"
          />
        </div>
        <p aria-live="polite" className="whitespace-nowrap text-sm text-gray-700">
          {filtered.length}건
        </p>
        {searchInput && (
          <button
            type="button"
            onClick={() => set("searchInput", "")}
            className="min-h-[44px] whitespace-nowrap px-2 text-xs text-gray-700 underline"
          >
            검색 지우기
          </button>
        )}
      </div>

      {loading ? (
        <ul className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-brown">조건에 맞는 신청이 없어요</p>
          <p className="mt-1.5 text-xs leading-5 break-keep text-gray-700">
            필터를 &lsquo;전체&rsquo;로 되돌리거나 검색어를 지우면 전체 신청을 볼 수 있어요.
          </p>
        </div>
      ) : (
        <>
          {/* md 미만: 카드 */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((row, i) => (
              <BookingCard key={`${row[0]}-${row[3]}-${i}`} row={row} actions={actions} />
            ))}
          </ul>
          {/* md 이상: 표 */}
          <div className="hidden md:block">
            <BookingTable rows={filtered} actions={actions} onSelect={setSelected} />
          </div>
        </>
      )}

      <BookingDrawer row={selected} actions={actions} onClose={closeDrawer} />
    </div>
  );
}
