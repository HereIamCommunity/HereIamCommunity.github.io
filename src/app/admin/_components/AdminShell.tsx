"use client";

import { useState } from "react";
import type { Digest } from "@/lib/digest";
import Banner from "./Banner";
import ListTab from "./ListTab";
import OpenStayTab from "./OpenStayTab";
import RetreatTab from "./RetreatTab";
import SettingsTab from "./SettingsTab";
import StayCalendarTab from "./StayCalendarTab";
import TodayTab from "./TodayTab";
import type { ApiResult } from "./useAdminApi";
import {
  findConflicts,
  type AdminActions,
  type DateRange,
  type Row,
  type StatusFilter,
} from "./shared";

export const TABS = ["오늘", "목록", "스테이 캘린더", "리트릿", "무료개방", "설정"] as const;
export type TabName = (typeof TABS)[number];

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
  const [tab, setTab] = useState<TabName>("오늘");
  const [requestedStatus, setRequestedStatus] = useState<StatusFilter | undefined>(undefined);

  const stayRows = rows.filter((r) => r[1] === "스테이" && (r[13] ?? "").trim() !== "취소");
  const conflicts = findConflicts(stayRows, airbnbRanges, digest.today);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      {topSlot}

      <header className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
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
              key={t}
              type="button"
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => setTab(t)}
              className={`-mb-px min-h-[44px] whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${
                tab === t ? "border-orange font-semibold text-brown" : "border-transparent text-gray-600 hover:text-brown"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "오늘" && (
          <TodayTab
            digest={digest}
            actions={actions}
            conflicts={conflicts}
            onGoList={() => {
              setRequestedStatus("전체");
              setTab("목록");
            }}
            onGoCalendar={() => setTab("스테이 캘린더")}
          />
        )}
        {tab === "목록" && (
          <ListTab
            rows={rows}
            actions={actions}
            todayISO={digest.today}
            loading={loading}
            requestedStatus={requestedStatus}
          />
        )}
        {tab === "스테이 캘린더" && (
          <StayCalendarTab stayRows={stayRows} airbnbRanges={airbnbRanges} todayISO={digest.today} />
        )}
        {tab === "리트릿" && (
          <RetreatTab retreats={retreats} counts={digest.retreatCounts} actions={actions} loading={loading} />
        )}
        {tab === "무료개방" && <OpenStayTab openStays={openStays} actions={actions} loading={loading} />}
        {tab === "설정" && <SettingsTab apiFetch={apiFetch} />}
      </div>
    </div>
  );
}
