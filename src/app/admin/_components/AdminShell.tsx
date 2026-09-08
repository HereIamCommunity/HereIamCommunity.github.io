"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Digest } from "@/lib/digest";
import { buildStats } from "@/lib/stats";
import Banner from "./Banner";
import ListTab from "./ListTab";
import OpenStayTab from "./OpenStayTab";
import RetreatTab from "./RetreatTab";
import SettingsTab from "./SettingsTab";
import StatsTab from "./StatsTab";
import StayCalendarTab from "./StayCalendarTab";
import ToastStack, { type ToastApi } from "./Toast";
import TodayTab from "./TodayTab";
import type { ApiResult } from "./useAdminApi";
import {
  amountText,
  BTN_OUTLINE,
  FIELD,
  filterBookings,
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

function isTabKey(v: string | null): v is TabKey {
  return !!v && TABS.some((t) => t.key === v);
}

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
  toasts,
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
  /** 처리 결과 토스트 — 상태는 데이터·액션을 쥔 page/preview가 갖고, 표시는 셸이 맡는다 */
  toasts: ToastApi;
  topSlot?: React.ReactNode;
}) {
  const [tab, setTabState] = useState<TabKey>("today");

  // ?tab=stats 딥링크. 정적 프리렌더 HTML은 항상 "today"라 하이드레이션 이후에만 반영한다.
  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      const q = new URLSearchParams(window.location.search).get("tab");
      if (isTabKey(q)) setTabState(q);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 좁은 화면에서 탭 스트립이 가로로 밀릴 때, 선택된 탭이 화면 밖이면 보이게 당긴다.
  const tabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    tabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  /** 탭을 바꾸면 주소도 같이 갱신한다 (새로고침·공유해도 같은 탭) */
  const setTab = useCallback((next: TabKey) => {
    setTabState(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url);
    } catch {
      /* 주소 갱신에 실패해도 화면 전환에는 영향이 없다 */
    }
  }, []);

  // 목록 탭 필터는 여기서 들고 있는다 — 탭을 왕복해도 필터·검색어가 살아 있어야 한다.
  const [listFilters, setListFilters] = useState<ListFilters>(DEFAULT_FILTERS);

  /* ── 전역 검색 (6.4) ────────────────────────────────
     입력은 헤더가 즉시 반영하고(끊김 없는 타이핑), 필터에는 200ms 디바운스로 넘긴다.
     API를 때리지는 않지만 목록 전체를 다시 거르는 일이라 키 입력마다 하면 낭비다. */
  const [searchDraft, setSearchDraft] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setListFilters((prev) => (prev.searchInput === searchDraft ? prev : { ...prev, searchInput: searchDraft }));
      // 어느 탭에 있든 검색을 시작하면 결과가 보이는 목록 탭으로 데려간다.
      if (searchDraft.trim()) setTab("list");
    }, 200);
    return () => clearTimeout(t);
  }, [searchDraft, setTab]);

  // "/"로 검색창 포커스, 검색창에서 Esc면 비우기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape" && el === searchRef.current) setSearchDraft("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 검색창 옆 "N건" — 목록 탭이 실제로 그리는 것과 같은 함수를 써서 숫자가 어긋나지 않는다.
  const resultCount = useMemo(
    () => filterBookings(rows, listFilters, digest.today).length,
    [rows, listFilters, digest.today]
  );

  // 헤더 스트립에서 열 때는 필터를 통째로 초기화한다 — 스트립 숫자와 목록 건수가 같은 조건이어야 한다.
  // 확정은 digest.month(이번 달 신청) 기준, 입금대기는 전 기간 기준.
  const openList = (statusFilter: StatusFilter) => {
    setSearchDraft("");
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
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
      {topSlot && <div className="pt-6 md:pt-8">{topSlot}</div>}

      {/* 고정 헤더 (6.4) — 제목·날짜·버튼 + 이번 달 스트립 + 탭 스트립 + 전역 검색.
          어느 탭에서 얼마나 내려가 있든 [새로고침]과 탭 이동이 손에 닿는 곳에 있어야 한다. */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-gray-200 bg-cream/95 px-4 pt-3 backdrop-blur md:-mx-6 md:px-6 md:pt-6">
        <header>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="whitespace-nowrap text-xl font-light text-brown md:text-2xl">코이노니아 어드민</h1>
              <p className="mt-0.5 whitespace-nowrap text-xs text-gray-700 tabular-nums">
                {headerDate(digest.today)} · 전체 {rows.length}건
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={onRefresh} disabled={loading} className={BTN_OUTLINE}>
                {loading ? "불러오는 중…" : "새로고침"}
              </button>
              <button type="button" onClick={onLogout} className={BTN_OUTLINE}>
                로그아웃
              </button>
            </div>
          </div>

          {/* 이번 달 요약 — 어느 탭에서도 보이게 헤더에 둔다.
              360px에서 한 줄에 안 들어가면 항목 단위로만 줄바꿈된다(항목 안은 nowrap). */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-200 pt-2 text-sm">
            <button
              type="button"
              onClick={() => openList("확정")}
              className="min-h-9 whitespace-nowrap py-1.5 underline decoration-gray-300 underline-offset-4 hover:decoration-orange"
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
              className="min-h-9 whitespace-nowrap py-1.5 underline decoration-gray-300 underline-offset-4 hover:decoration-orange"
            >
              <span className="text-gray-500">입금대기</span>{" "}
              <span className="font-medium text-brown tabular-nums">{digest.pending.length}건</span>
            </button>
          </div>
        </header>

        {/* 탭 스트립 + 전역 검색 — md 이상은 한 줄, 그 아래는 검색이 탭 밑으로 내려간다 */}
        <div className="mt-1.5 flex flex-col gap-1.5 md:mt-2 md:flex-row md:items-end md:gap-4">
          <div className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 scroll-px-4 md:mx-0 md:px-0">
            <div role="tablist" aria-label="어드민 화면" className="flex w-max gap-5 border-b border-gray-200">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  ref={tab === t.key ? tabRef : undefined}
                  type="button"
                  role="tab"
                  id={`tab-${t.key}`}
                  aria-selected={tab === t.key}
                  // 활성 패널만 렌더하므로 선택된 탭에서만 aria-controls를 건다(빈 IDREF 방지)
                  aria-controls={tab === t.key ? `panel-${t.key}` : undefined}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px h-11 whitespace-nowrap border-b-2 text-sm font-medium transition-colors ${
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

          <div className="flex shrink-0 items-center gap-2 pb-2 md:pb-2">
            <label htmlFor="admin-search" className="sr-only">
              이름·연락처·프로그램 검색
            </label>
            <input
              id="admin-search"
              ref={searchRef}
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="이름·연락처·프로그램 검색"
              className={`${FIELD} md:w-64`}
            />
            <p aria-live="polite" className="shrink-0 whitespace-nowrap text-xs text-gray-700 tabular-nums">
              {resultCount}건
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Banner
            tone="error"
            title={error}
            detail="화면에 보이는 값이 최신이 아닐 수 있어요. 새로고침을 눌러 다시 불러와주세요."
            action={{ label: "새로고침", onClick: onRefresh }}
          />
        </div>
      )}

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="overflow-x-clip py-5 md:py-6"
      >
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

      <ToastStack {...toasts} />
    </div>
  );
}
