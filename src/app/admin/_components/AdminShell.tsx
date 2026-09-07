"use client";

import { useState } from "react";
import type { Digest } from "@/lib/digest";
import { buildStats } from "@/lib/stats";
import Banner from "./Banner";
import ListTab from "./ListTab";
import OpenStayTab from "./OpenStayTab";
import RetreatTab from "./RetreatTab";
import SettingsTab from "./SettingsTab";
import StatsTab from "./StatsTab";
import StayCalendarTab from "./StayCalendarTab";
import TodayTab from "./TodayTab";
import type { ApiResult } from "./useAdminApi";
import {
  amountText,
  findConflicts,
  type AdminActions,
  type DateRange,
  type ListFilters,
  type Row,
  type StatusFilter,
} from "./shared";

/** key는 aria-controls/id용 (라벨에 공백이 있어 IDREF로 못 쓴다) */
export const TABS = [
  { key: "today", label: "오늘" },
  { key: "list", label: "목록" },
  { key: "stats", label: "통계" },
  { key: "stay", label: "스테이 캘린더" },
  { key: "retreat", label: "리트릿" },
  { key: "open", label: "무료개방" },
  { key: "settings", label: "설정" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

const DEFAULT_FILTERS: ListFilters = {
  period: "전체",
  typeFilter: "전체",
  statusFilter: "전체",
  searchInput: "",
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function headerDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${iso} (${DOW[new Date(y, m - 1, d).getDay()]})`;
}

/**
 * 어드민 화면 셸 — 헤더 + 탭 + 각 탭 본문.
 * 인증·데이터 로드는 page.tsx가, 샘플 데이터는 preview/page.tsx가 넣는다.
 */
export default function AdminShell({
  digest,
  rawRows,
  rows,
  retreats,
  openStays,
  airbnbRanges,
  actions,
  apiFetch,
  loading,
  error,
  onRefresh,
  onLogout,
  topSlot,
}: {
  digest: Digest;
  /** 헤더 행을 포함한 예약 원본 — buildStats가 내부에서 slice(1) 한다 */
  rawRows: Row[];
  rows: Row[];
  retreats: Row[];
  openStays: Row[];
  airbnbRanges: Record<string, DateRange[]>;
  actions: AdminActions;
  apiFetch: (path: string, init?: RequestInit) => Promise<ApiResult>;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onLogout: () => void;
  topSlot?: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("today");
  // 목록 탭 필터는 여기서 들고 있는다 — 탭을 왕복해도 필터·검색어가 살아 있어야 한다.
  const [listFilters, setListFilters] = useState<ListFilters>(DEFAULT_FILTERS);

  // 헤더 스트립에서 열 때는 필터를 통째로 초기화한다 — 스트립 숫자와 목록 건수가 같은 조건이어야 한다.
  // 확정은 digest.month(이번 달 신청) 기준, 입금대기는 전 기간 기준.
  const openList = (statusFilter: StatusFilter) => {
    setListFilters({
      ...DEFAULT_FILTERS,
      statusFilter,
      period: statusFilter === "확정" ? "이번 달" : "전체",
    });
    setTab("list");
  };

  const stayRows = rows.filter((r) => r[1] === "스테이" && (r[13] ?? "").trim() !== "취소");
  const conflicts = findConflicts(stayRows, airbnbRanges, digest.today);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      {topSlot}

      <header className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="whitespace-nowrap text-xl font-light text-brown md:text-2xl">코이노니아 어드민</h1>
            <p className="mt-0.5 whitespace-nowrap text-xs text-gray-700 tabular-nums">
              {headerDate(digest.today)} · 전체 {rows.length}건
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="min-h-[44px] whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 hover:border-brown disabled:opacity-40"
            >
              {loading ? "불러오는 중…" : "새로고침"}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 hover:border-brown"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 이번 달 요약 — 어느 탭에서도 보이게 헤더에 둔다.
            360px에서 한 줄에 안 들어가면 항목 단위로만 줄바꿈된다(항목 안은 nowrap). */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-200 pt-3 text-sm">
          <button
            type="button"
            onClick={() => openList("확정")}
            className="whitespace-nowrap min-h-9 py-1.5 underline decoration-gray-300 underline-offset-4 hover:decoration-orange"
          >
            <span className="text-gray-500">이번 달 확정</span>{" "}
            <span className="font-medium text-brown tabular-nums">{digest.month.confirmedCount}건</span>
          </button>
          <span aria-hidden="true" className="text-gray-500">
            ·
          </span>
          <span className="whitespace-nowrap py-1 font-medium text-brown tabular-nums">
            {amountText(String(digest.month.confirmedAmount))}
          </span>
          <span aria-hidden="true" className="text-gray-500">
            ·
          </span>
          <button
            type="button"
            onClick={() => openList("입금대기")}
            className="whitespace-nowrap min-h-9 py-1.5 underline decoration-gray-300 underline-offset-4 hover:decoration-orange"
          >
            <span className="text-gray-500">입금대기</span>{" "}
            <span className="font-medium text-brown tabular-nums">{digest.pending.length}건</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <Banner
            tone="error"
            title={error}
            detail="화면에 보이는 값이 최신이 아닐 수 있어요. 새로고침을 눌러 다시 불러와주세요."
            action={{ label: "새로고침", onClick: onRefresh }}
          />
        </div>
      )}

      <div className="mb-5 -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div role="tablist" aria-label="어드민 화면" className="flex w-max gap-1 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              // 활성 패널만 렌더하므로 선택된 탭에서만 aria-controls를 건다(빈 IDREF 방지)
              aria-controls={tab === t.key ? `panel-${t.key}` : undefined}
              onClick={() => setTab(t.key)}
              className={`-mb-px min-h-[44px] whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-orange font-semibold text-brown"
                  : "border-transparent text-gray-600 hover:text-brown"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === "today" && (
          <TodayTab
            digest={digest}
            actions={actions}
            conflicts={conflicts}
            onGoCalendar={() => setTab("stay")}
          />
        )}
        {tab === "list" && (
          <ListTab
            rows={rows}
            actions={actions}
            todayISO={digest.today}
            loading={loading}
            filters={listFilters}
            onFiltersChange={setListFilters}
          />
        )}
        {tab === "stats" && <StatsTab stats={buildStats(rawRows)} loading={loading} />}
        {tab === "stay" && (
          <StayCalendarTab stayRows={stayRows} airbnbRanges={airbnbRanges} todayISO={digest.today} />
        )}
        {tab === "retreat" && (
          <RetreatTab retreats={retreats} counts={digest.retreatCounts} actions={actions} loading={loading} />
        )}
        {tab === "open" && <OpenStayTab openStays={openStays} actions={actions} loading={loading} />}
        {tab === "settings" && <SettingsTab apiFetch={apiFetch} />}
      </div>
    </div>
  );
}
