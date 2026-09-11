"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { RowRef } from "@/lib/row-ref";
import Banner from "./Banner";
import ConfirmCancelDialog from "./ConfirmCancelDialog";
import { Spinner } from "./RowActions";
import StatusBadge, { TypeBadge } from "./StatusBadge";
import type { ToastInput } from "./Toast";
import type { ApiResult } from "./useAdminApi";
import {
  BTN_CONFIRM,
  BTN_OUTLINE,
  BTN_SMALL,
  CARD,
  FIELD,
  SECTION_H,
  TD_CELL,
  TH_CELL,
  shortDate,
  type ListFilters,
  type ListRange,
} from "./shared";

/* ── 일괄 처리 패널 (7장) ────────────────────────────────
   "사용일 지난 입금대기 99건을 한 번에 확정" 같은 정리 작업을 화면에서 끝낸다.

   설계에서 물러서지 않은 두 가지:
   1) 대상 건수는 **서버가 센다.** 화면에서 따로 세면 실행 대상과 어긋날 수 있고,
      그 어긋남이 곧 "엉뚱한 99명에게 알림톡"이 된다. 미리보기 응답의 jobId를 실행에
      그대로 돌려줘 서버가 같은 대상인지 다시 확인한다(다르면 409).
   2) 조건을 하나라도 건드리면 미리보기는 무효다. [실행]은 즉시 잠기고 다시 세라고 말한다.

   9장에서 대상 소스가 둘로 나뉘었다:
   - **현재 목록 조건** — 지금 목록 탭이 보여주는 그 건들. 화면·서버가 `filterBookings`
     한 함수를 공유하므로 건수가 같아야 정상이고, **다르면 실행을 잠근다**(아래 mismatch).
   - **직접 조건** — 사용일/상태/구분을 이 패널에서 따로 고르는 기존 흐름. */

export type BulkStatusFilter = "pending" | "confirmed" | "cancelled" | "all";
export type BulkTypeFilter = "all" | "salon" | "stay";
export type BulkActionKey = "confirm" | "cancel" | "reopen";
/** 일괄 처리 대상을 어디서 가져오는지 (9장) */
export type BulkSource = "list" | "filter";

export type BulkFilter = {
  usageBefore?: string;
  usageAfter?: string;
  status: BulkStatusFilter;
  type: BulkTypeFilter;
};

/** 응답의 행 참조. `{tab,rowNum}`이 계약이지만 문자열로 와도 화면이 깨지지 않게 둘 다 받는다. */
export type BulkRowRef = RowRef | string;

export type BulkPreviewRow = { ref?: BulkRowRef; name: string; type: string; usage: string; status: string };
export type BulkPreview = {
  jobId: string;
  count: number;
  byType?: { salon: number; stay: number };
  rows?: BulkPreviewRow[];
};
/** 건너뜀·실패는 건수가 아니라 "누가 왜"까지 온다 — 운영자가 다음 행동을 정할 수 있어야 한다. */
export type BulkSkipped = { ref?: BulkRowRef; name?: string; reason: string };
export type BulkFailed = { ref?: BulkRowRef; name?: string; error: string };
export type BulkRunResult = {
  jobId?: string;
  at?: string;
  updated: number;
  notified: number;
  skipped?: BulkSkipped[];
  failed?: BulkFailed[];
  /** false면 되돌리기 스냅샷이 안 남았다는 뜻 */
  logged?: boolean;
  /** 대상을 무엇으로 골랐는지 — "list"면 현재 목록 조건 */
  source?: BulkSource;
};
/** `reverted`는 되돌린 시각 문자열("" = 아직) */
export type BulkJob = {
  jobId: string;
  at: string;
  summary: string;
  action?: BulkActionKey;
  notify?: boolean;
  count: number;
  reverted: string | boolean;
  source?: BulkSource;
};

/** 목록에 그리는 최대 행 수 — 그 위로는 세로로만 스크롤한다 */
const MAX_LIST_ROWS = 200;
/** 서버가 한 번에 받는 상한(스냅샷이 시트 한 셀에 들어가야 한다). 넘으면 run이 400. */
const MAX_TARGETS = 500;

const ACTION_LABEL: Record<BulkActionKey, string> = {
  confirm: "입금확인",
  cancel: "취소",
  reopen: "되돌리기",
};

const ACTION_OPTIONS: { key: BulkActionKey; label: string }[] = [
  { key: "confirm", label: "입금확인 (확정으로)" },
  { key: "cancel", label: "취소" },
  { key: "reopen", label: "되돌리기 (신청으로)" },
];

const STATUS_OPTIONS: { key: BulkStatusFilter; label: string }[] = [
  { key: "pending", label: "입금대기" },
  { key: "confirmed", label: "확정" },
  { key: "cancelled", label: "취소" },
  { key: "all", label: "전체" },
];

const TYPE_OPTIONS: { key: BulkTypeFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "salon", label: "살롱" },
  { key: "stay", label: "스테이" },
];

const STATUS_LABEL: Record<BulkStatusFilter, string> = {
  pending: "입금대기",
  confirmed: "확정",
  cancelled: "취소",
  all: "전체 상태",
};
const TYPE_LABEL: Record<BulkTypeFilter, string> = { all: "살롱·스테이", salon: "살롱", stay: "스테이" };

/** 서버가 영문 키로 줄 수도, 시트 값 그대로 줄 수도 있어 화면 쪽에서 한 번 맞춘다 */
function typeText(raw: string): string {
  return raw === "stay" || raw === "스테이" ? "스테이" : "살롱";
}
function statusText(raw: string): string {
  if (raw === "pending") return "신청";
  if (raw === "confirmed") return "입금확인";
  if (raw === "cancelled") return "취소";
  return raw;
}
/** "2026-09-10" → "9/10(목)", 그 밖의 형식은 그대로 */
function usageText(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "—";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? shortDate(s) : s;
}
function refLabel(ref: BulkRowRef | undefined): string {
  if (!ref) return "행 정보 없음";
  if (typeof ref === "string") return ref;
  return `${ref.tab} ${ref.rowNum}행`;
}
/** 실패·건너뜀 한 줄의 머리 — 이름이 있으면 이름, 없으면 시트 행 번호 */
function whoLabel(item: { ref?: BulkRowRef; name?: string }): string {
  return item.name?.trim() ? `${item.name} (${refLabel(item.ref)})` : refLabel(item.ref);
}
/** "2026-09-10 14:32:05" → "9/10 14:32" (한 줄에 들어가야 한다) */
function jobTime(at: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec((at ?? "").trim());
  return m ? `${Number(m[1])}/${Number(m[2])} ${m[3]}` : (at ?? "");
}

/** 기간설정 한 줄 요약 — "사용일 2026-08-01~2026-09-10" / 한쪽만 넣었으면 "…부터"·"…까지" */
function rangeText(range: ListRange | undefined): string {
  const basis = range?.basis === "created" ? "신청일" : "사용일";
  const from = range?.from?.trim();
  const to = range?.to?.trim();
  if (from && to) return `${basis} ${from}~${to}`;
  if (from) return `${basis} ${from}부터`;
  if (to) return `${basis} ${to}까지`;
  return `${basis} 기간 미지정`;
}

/**
 * 목록 탭 필터를 사람이 읽는 한 줄로. 검색어는 대상을 크게 줄이는데도 칩처럼 눈에 띄지
 * 않아서, 걸려 있으면 **반드시 문장에 적는다**.
 * preview 페이지의 가짜 API도 최근 기록 요약에 같은 문장을 쓴다.
 */
export function summarizeListFilters(f: ListFilters): string {
  const period =
    f.period === "기간설정" ? rangeText(f.range) : f.period === "전체" ? "전체 기간" : `${f.period} 신청`;
  const status = f.statusFilter === "전체" ? "전체 상태" : f.statusFilter;
  const type = f.typeFilter === "전체" ? "살롱·스테이" : f.typeFilter;
  const q = f.searchInput.trim();
  return `${period} · ${status} · ${type} · ${q ? `검색어 ‘${q}’ 포함` : "검색어 없음"}`;
}

function errorOf(data: unknown, fallback: string): string {
  const e = (data as { error?: unknown } | null)?.error;
  return typeof e === "string" && e ? e : fallback;
}

export default function BulkPanel({
  apiFetch,
  push,
  onDone,
  todayISO,
  listFilters,
  listCount,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<ApiResult>;
  push: (t: ToastInput) => void;
  /** 실행·되돌리기 뒤 목록 재조회 */
  onDone: () => void;
  todayISO: string;
  /** 목록 탭이 지금 쓰고 있는 필터 — "현재 목록 조건"으로 그대로 서버에 넘긴다 */
  listFilters: ListFilters;
  /** 그 필터로 화면이 실제로 그린 건수 — 서버가 센 대상 수와 대조한다 */
  listCount: number;
}) {
  const listId = useId();
  const failedId = useId();
  const skippedId = useId();

  const sourceName = useId();
  // 9장의 기본값은 "현재 목록 조건" — 목록에서 걸러 본 걸 그대로 처리하는 게 이 기능의 시작이다.
  const [source, setSource] = useState<BulkSource>("list");

  const [dir, setDir] = useState<"before" | "after">("before");
  const [date, setDate] = useState(todayISO);
  const [status, setStatus] = useState<BulkStatusFilter>("pending");
  const [type, setType] = useState<BulkTypeFilter>("all");
  const [action, setAction] = useState<BulkActionKey>("confirm");
  const [silent, setSilent] = useState(true);

  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  /** 미리보기는 그때의 조건과 함께 들고 있는다 — 조건이 바뀌면 곧바로 무효가 된다 */
  const [preview, setPreview] = useState<{ key: string; data: BulkPreview } | null>(null);
  const [showRows, setShowRows] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BulkRunResult | null>(null);
  const [showFailed, setShowFailed] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [asking, setAsking] = useState(false);

  const [jobs, setJobs] = useState<BulkJob[] | null>(null);
  const [jobsError, setJobsError] = useState("");
  const [revertTarget, setRevertTarget] = useState<BulkJob | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const filter: BulkFilter = useMemo(
    () => ({ status, type, ...(dir === "before" ? { usageBefore: date } : { usageAfter: date }) }),
    [status, type, dir, date]
  );

  /** 서버로 보내는 대상 지정 — 소스에 따라 `listFilters`나 `filter` 한쪽만 실린다 */
  const targetBody = useMemo(
    () => (source === "list" ? { listFilters } : { filter }),
    [source, listFilters, filter]
  );

  /** 대상이 달라지는 조건 + 동작. 알림 여부는 대상을 바꾸지 않으므로 뺀다. */
  const conditionKey = useMemo(
    () => JSON.stringify({ source, ...targetBody, action }),
    [source, targetBody, action]
  );
  const stale = !!preview && preview.key !== conditionKey;
  const tooMany = !!preview && preview.data.count > MAX_TARGETS;
  /**
   * 목록 건수 ≠ 서버가 센 대상 수. 같은 `filterBookings`를 쓰는데 갈라졌다는 건 화면이
   * 들고 있는 데이터가 이미 낡았다는 뜻이라, 여기서 실행을 막는다.
   */
  const mismatch = !!preview && !stale && source === "list" && preview.data.count !== listCount;
  const ready = !!preview && !stale && preview.data.count > 0 && !tooMany && !mismatch;

  const filterLine = `사용일 ${date} ${dir === "before" ? "이전" : "이후"} · ${STATUS_LABEL[status]} · ${TYPE_LABEL[type]}`;
  const listLine = summarizeListFilters(listFilters);
  const conditionLine = source === "list" ? listLine : filterLine;

  const loadJobs = useCallback(async () => {
    setJobsError("");
    const res = await apiFetch("/api/admin/bulk");
    if (!res.ok) {
      setJobs([]);
      setJobsError(errorOf(res.data, `기록을 불러오지 못했어요 (${res.status})`));
      return;
    }
    const list = (res.data as { jobs?: BulkJob[] } | null)?.jobs;
    setJobs(Array.isArray(list) ? list : []);
  }, [apiFetch]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const doPreview = useCallback(async () => {
    setPreviewing(true);
    setPreviewError("");
    setResult(null);
    setShowFailed(false);
    setShowSkipped(false);
    const res = await apiFetch("/api/admin/bulk", {
      method: "POST",
      body: JSON.stringify({ mode: "preview", ...targetBody, action, notify: !silent }),
    });
    setPreviewing(false);
    const d = res.data as (BulkPreview & { ok?: boolean }) | null;
    if (!res.ok || !d || typeof d.jobId !== "string") {
      setPreview(null);
      setPreviewError(errorOf(res.data, `대상을 세지 못했어요 (${res.status})`));
      return;
    }
    setPreview({ key: conditionKey, data: d });
    setShowRows(false);
  }, [apiFetch, targetBody, action, silent, conditionKey]);

  const doRun = useCallback(
    // 이름 있는 함수 표현식 — 실패 토스트의 [다시 시도]가 자기 자신을 그대로 다시 부른다
    async function run(jobId: string) {
      setRunning(true);
      const res = await apiFetch("/api/admin/bulk", {
        method: "POST",
        body: JSON.stringify({ mode: "run", ...targetBody, action, notify: !silent, jobId }),
      });
      setRunning(false);
      const d = res.data as (BulkRunResult & { ok?: boolean }) | null;

      // 409 = 그 사이 시트가 바뀐 것. 응답에 새 건수가 실려 오지만, 목록까지 최신으로
      // 맞춘 뒤 사람이 다시 확인하는 게 맞다 — 미리보기를 새로 돌리고 실행은 잠근다.
      if (res.status === 409) {
        setPreview(null);
        push({
          kind: "error",
          text: errorOf(res.data, "대상이 바뀌었어요.") + " 미리보기를 새로 했으니 확인 후 다시 실행해주세요.",
        });
        await doPreview();
        return;
      }
      if (!res.ok || !d || typeof d.updated !== "number") {
        push({
          kind: "error",
          text: `일괄 ${ACTION_LABEL[action]} 실패 — ${errorOf(res.data, `처리하지 못했어요 (${res.status})`)}`,
          onRetry: () => void run(jobId),
        });
        return;
      }

      const failedCount = d.failed?.length ?? 0;
      const skippedCount = d.skipped?.length ?? 0;
      // 서버가 source를 돌려주면 그 값이 사실이고, 아니면 화면이 고른 소스를 그대로 쓴다.
      const usedList = (d.source ?? source) === "list";
      setResult({ ...d, source: usedList ? "list" : "filter" });
      setShowFailed(false);
      setShowSkipped(false);
      setPreview(null);
      push({
        kind: failedCount > 0 ? "error" : "ok",
        text: `일괄 ${ACTION_LABEL[action]}${usedList ? " (현재 목록 기준)" : ""} — 성공 ${d.updated}건 · 건너뜀 ${skippedCount}건 · 실패 ${failedCount}건`,
      });
      await loadJobs();
      onDone();
    },
    [apiFetch, targetBody, source, action, silent, push, loadJobs, onDone, doPreview]
  );

  const doRevert = useCallback(
    async function run(job: BulkJob) {
      setRevertingId(job.jobId);
      const res = await apiFetch("/api/admin/bulk/revert", {
        method: "POST",
        body: JSON.stringify({ jobId: job.jobId }),
      });
      setRevertingId(null);
      const d = res.data as { ok?: boolean } | null;
      if (!res.ok || !d?.ok) {
        push({
          kind: "error",
          text: `되돌리기 실패 — ${errorOf(res.data, `처리하지 못했어요 (${res.status})`)}`,
          onRetry: () => void run(job),
        });
        return;
      }
      push({ kind: "ok", text: `${job.summary} ${job.count}건을 처리 전으로 되돌렸어요.` });
      await loadJobs();
      onDone();
    },
    [apiFetch, push, loadJobs, onDone]
  );

  const count = preview?.data.count ?? 0;
  const byType = preview?.data.byType;
  const rows = preview?.data.rows ?? [];
  const shownRows = rows.slice(0, MAX_LIST_ROWS);
  const failedList = result?.failed ?? [];
  const skippedList = result?.skipped ?? [];

  return (
    <section className={CARD} aria-labelledby="bulk-heading">
      <h2 id="bulk-heading" className={SECTION_H}>
        일괄 처리
      </h2>
      <p className="mt-1 text-xs leading-5 break-keep text-gray-700">
        조건에 맞는 신청을 한 번에 바꿉니다. 미리보기로 대상을 확인한 뒤에만 실행할 수 있어요.
      </p>

      {/* 실행 중에는 조건을 못 바꾸게 잠그고(fieldset disabled) 패널을 흐리게 한다 */}
      <div className={running ? "opacity-60 transition-opacity motion-reduce:transition-none" : ""}>
        <fieldset disabled={running} className="mt-4 space-y-3">
          <legend className="sr-only">일괄 처리 조건과 동작</legend>

          {/* 대상 소스 — 패널 최상단. 무엇을 처리하는지가 어떤 동작인지보다 먼저다. */}
          <fieldset>
            <legend className="sr-only">일괄 처리 대상 고르기</legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="whitespace-nowrap text-xs font-medium text-gray-700">대상</span>
              {(
                [
                  { key: "list", label: `현재 목록 조건 (${listCount}건)` },
                  { key: "filter", label: "직접 조건" },
                ] as const
              ).map((o) => (
                <label key={o.key} className="flex h-11 items-center gap-2 whitespace-nowrap text-sm text-brown">
                  <input
                    type="radio"
                    name={sourceName}
                    value={o.key}
                    checked={source === o.key}
                    onChange={() => setSource(o.key)}
                    className="h-4 w-4 accent-orange-dark"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* 현재 목록 조건이면 조건 칸을 아예 감추고, 지금 걸려 있는 필터를 한 줄로 되읽어준다 */}
          {source === "list" && (
            <div className="rounded-lg border border-gray-200 bg-cream/60 p-3">
              <p className="text-sm leading-6 break-keep text-brown">{listLine}</p>
              <p className="mt-1 text-xs leading-5 break-keep text-gray-700">
                지금 목록에 보이는 {listCount}건이 그대로 대상이에요. 위쪽 칩·검색어를 바꾸면 대상도 같이 바뀝니다.
              </p>
            </div>
          )}

          <div className={`grid gap-3 md:grid-cols-2 lg:grid-cols-4 ${source === "list" ? "hidden" : ""}`}>
            <fieldset className="lg:col-span-2">
              <legend className="mb-1.5 text-xs font-medium text-gray-700">사용일 기준</legend>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {(
                  [
                    { key: "before", label: "이전" },
                    { key: "after", label: "이후" },
                  ] as const
                ).map((o) => (
                  <label key={o.key} className="flex h-11 items-center gap-2 whitespace-nowrap text-sm text-brown">
                    <input
                      type="radio"
                      name="bulk-usage-dir"
                      value={o.key}
                      checked={dir === o.key}
                      onChange={() => setDir(o.key)}
                      className="h-4 w-4 accent-orange-dark"
                    />
                    {o.label}
                  </label>
                ))}
                <label htmlFor="bulk-date" className="sr-only">
                  기준 사용일
                </label>
                <input
                  id="bulk-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-describedby="bulk-date-hint"
                  className={`${FIELD} min-w-0 flex-1 tabular-nums sm:w-44 sm:flex-none`}
                />
              </div>
              <p id="bulk-date-hint" className="mt-1.5 text-xs leading-5 break-keep text-gray-700">
                이전은 그 날짜 앞, 이후는 그 날짜를 포함합니다. 사용일은 스테이 체크인 · 살롱 일시이고,
                사용일을 읽을 수 없는 행은 대상에서 빠져요.
              </p>
            </fieldset>

            <div>
              <label htmlFor="bulk-status" className="mb-1.5 block text-xs font-medium text-gray-700">
                상태
              </label>
              <select
                id="bulk-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as BulkStatusFilter)}
                className={FIELD}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="bulk-type" className="mb-1.5 block text-xs font-medium text-gray-700">
                구분
              </label>
              <select
                id="bulk-type"
                value={type}
                onChange={(e) => setType(e.target.value as BulkTypeFilter)}
                className={FIELD}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label htmlFor="bulk-action" className="mb-1.5 block text-xs font-medium text-gray-700">
                동작
              </label>
              <select
                id="bulk-action"
                value={action}
                onChange={(e) => setAction(e.target.value as BulkActionKey)}
                className={FIELD}
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end lg:col-span-2">
              <label className="flex min-h-11 items-center gap-2 text-sm break-keep text-brown">
                <input
                  type="checkbox"
                  checked={silent}
                  onChange={(e) => setSilent(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-orange-dark"
                />
                알림 보내지 않기 (고객·호스트 모두)
              </label>
            </div>
          </div>
        </fieldset>

        {!silent && (
          <div className="mt-3">
            <Banner
              tone="warn"
              title={count > 0 ? `${count}명에게 알림톡이 나갑니다` : "대상 전원에게 알림톡이 나갑니다"}
              detail="한 건씩 순서대로 발송되고, 발송 결과는 각 행의 알림 열에 남아요. 정리 목적이라면 체크를 다시 켜주세요."
            />
          </div>
        )}

        {mismatch && (
          <div className="mt-3">
            <Banner
              tone="error"
              title={`목록 ${listCount}건 / 대상 ${count}건 — 숫자가 달라요`}
              detail="화면이 들고 있는 목록이 시트보다 낡았다는 뜻이에요. 새로고침한 뒤 미리보기를 다시 해주세요. 두 숫자가 같아지기 전까지는 실행할 수 없어요."
              action={{ label: "새로고침", onClick: onDone }}
            />
          </div>
        )}

        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" onClick={() => void doPreview()} disabled={running || previewing} className={BTN_OUTLINE}>
              {previewing && <Spinner />}
              미리보기
            </button>

            {/* 미리보기 결과 — 로딩·에러·빈·정상 네 가지를 같은 자리에서 말한다 */}
            <p aria-live="polite" className="min-w-0 flex-1 text-sm break-keep text-brown">
              {running ? (
                <span className="text-gray-700">
                  {silent
                    ? `${count}건을 처리하는 중이에요…`
                    : `${count}건을 처리하고 알림을 보내는 중이에요… (한 건씩 보내느라 시간이 걸려요)`}
                </span>
              ) : previewing ? (
                <span className="text-gray-700">대상을 세는 중이에요…</span>
              ) : previewError ? (
                <span className="text-brown">{previewError}</span>
              ) : !preview ? (
                <span className="text-gray-700">조건을 고르고 미리보기를 누르면 대상 건수를 보여드려요.</span>
              ) : stale ? (
                <span className="text-brown">조건이 바뀌었어요. 다시 미리보기를 눌러주세요.</span>
              ) : count === 0 ? (
                <span className="text-gray-700">조건에 맞는 신청이 없어요. 날짜나 상태를 바꿔보세요.</span>
              ) : tooMany ? (
                <span className="text-brown tabular-nums">
                  {count}건 — 한 번에 {MAX_TARGETS}건까지만 처리할 수 있어요. 날짜를 좁혀주세요.
                </span>
              ) : mismatch ? (
                <span className="text-brown tabular-nums">
                  목록 {listCount}건 / 대상 {count}건 — 새로고침 후 다시 시도해주세요.
                </span>
              ) : (
                <span className="tabular-nums">
                  <span className="font-medium">{count}건</span>
                  {byType && (
                    <span className="text-gray-700">
                      {" "}
                      (살롱 {byType.salon} · 스테이 {byType.stay})
                    </span>
                  )}
                </span>
              )}
            </p>

            {!!preview && !stale && rows.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRows((v) => !v)}
                aria-expanded={showRows}
                aria-controls={listId}
                className={`${BTN_SMALL} border-gray-300 text-gray-700 hover:border-brown`}
              >
                {showRows ? "목록 접기" : "목록 보기"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setAsking(true)}
              disabled={!ready || running}
              className={BTN_CONFIRM}
            >
              {running && <Spinner />}
              실행
            </button>
          </div>

          {/* 짧은 목록까지 스크롤 상자에 가두면 마지막 줄이 잘려 보인다 — 길 때만 높이를 묶는다 */}
          {!!preview && !stale && showRows && rows.length > 0 && (
            <div
              id={listId}
              className={`mt-3 overflow-auto rounded-lg border border-gray-200 ${
                shownRows.length > 6 ? "max-h-72" : ""
              }`}
            >
              {/* md 미만은 표 대신 행 — 390px에서 4열 표는 컨테이너 안에서 가로로 밀린다 */}
              <ul className="md:hidden">
                {shownRows.map((r, i) => (
                  <li key={`m-${refLabel(r.ref)}-${i}`} className="border-b border-gray-100 px-4 py-2.5 last:border-0">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-brown">
                        {r.name || "이름 없음"}
                      </span>
                      <span className="shrink-0">
                        <StatusBadge status={statusText(r.status)} />
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <TypeBadge type={typeText(r.type)} />
                      <span className="whitespace-nowrap text-xs text-gray-700 tabular-nums">{usageText(r.usage)}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <table className="hidden w-full min-w-[420px] text-sm md:table">
                <caption className="sr-only">일괄 처리 대상 {count}건</caption>
                <thead>
                  <tr className="border-b border-gray-200">
                    {["이름", "구분", "사용일", "상태"].map((h) => (
                      <th key={h} scope="col" className={`${TH_CELL} sticky top-0 z-10 bg-cream text-left`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map((r, i) => (
                    <tr key={`d-${refLabel(r.ref)}-${i}`} className="border-b border-gray-100 last:border-0">
                      <td className={`${TD_CELL} font-medium text-brown`}>{r.name || "이름 없음"}</td>
                      <td className={TD_CELL}>
                        <TypeBadge type={typeText(r.type)} />
                      </td>
                      <td className={`${TD_CELL} tabular-nums text-gray-700`}>{usageText(r.usage)}</td>
                      <td className={TD_CELL}>
                        <StatusBadge status={statusText(r.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > MAX_LIST_ROWS && (
                <p className="border-t border-gray-200 px-4 py-3 text-xs text-gray-700">
                  앞 {MAX_LIST_ROWS}건만 보여드려요. 실행 대상은 {count}건 전부입니다.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 실행 결과 — 토스트는 5초 뒤 사라지므로 요약은 패널에 남긴다 */}
      <div aria-live="polite">
        {result && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-cream/70 p-4">
            <p className="text-sm break-keep text-brown">
              {result.source === "list" && <span className="text-gray-700">현재 목록 기준 · </span>}
              <span className="font-medium tabular-nums">성공 {result.updated}건</span>
              <span className="text-gray-700 tabular-nums">
                {" · "}건너뜀 {skippedList.length}건 · 실패 {failedList.length}건
                {result.notified > 0 ? ` · 알림 ${result.notified}건 발송` : ""}
              </span>
            </p>
            {result.logged === false && result.updated > 0 && (
              <p className="mt-1.5 text-xs leading-5 break-keep text-brown">
                되돌리기 기록을 남기지 못했어요. 이 처리는 아래 목록에서 되돌릴 수 없습니다.
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap gap-2">
              {failedList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFailed((v) => !v)}
                  aria-expanded={showFailed}
                  aria-controls={failedId}
                  className={`${BTN_SMALL} border-orange-dark text-brown hover:bg-orange/10`}
                >
                  {showFailed ? "실패 목록 접기" : `실패 ${failedList.length}건 보기`}
                </button>
              )}
              {skippedList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSkipped((v) => !v)}
                  aria-expanded={showSkipped}
                  aria-controls={skippedId}
                  className={`${BTN_SMALL} border-gray-300 text-gray-700 hover:border-brown`}
                >
                  {showSkipped ? "건너뜀 목록 접기" : `건너뜀 ${skippedList.length}건 보기`}
                </button>
              )}
            </div>

            {failedList.length > 0 && showFailed && (
              <ul id={failedId} className="mt-2 max-h-48 space-y-1 overflow-auto">
                {failedList.map((f, i) => (
                  <li key={`${refLabel(f.ref)}-${i}`} className="text-xs leading-5 break-keep text-brown">
                    {whoLabel(f)} — {f.error}
                  </li>
                ))}
              </ul>
            )}
            {skippedList.length > 0 && showSkipped && (
              <ul id={skippedId} className="mt-2 max-h-48 space-y-1 overflow-auto">
                {skippedList.map((k, i) => (
                  <li key={`${refLabel(k.ref)}-${i}`} className="text-xs leading-5 break-keep text-gray-700">
                    {whoLabel(k)} — {k.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 최근 일괄 처리 — 잘못 눌렀을 때 돌아올 길이 항상 보여야 한다 */}
      <div className="mt-5 border-t border-gray-200 pt-4">
        <h3 className={SECTION_H}>최근 일괄 처리</h3>

        {jobs === null ? (
          <div className="mt-2 h-16 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" aria-busy="true" />
        ) : jobsError ? (
          <div className="mt-2">
            <Banner
              tone="error"
              title={jobsError}
              detail="기록을 못 불러와도 위쪽 미리보기·실행은 그대로 쓸 수 있어요."
              action={{ label: "다시 시도", onClick: () => void loadJobs() }}
            />
          </div>
        ) : jobs.length === 0 ? (
          <p className="mt-2 text-xs leading-5 break-keep text-gray-700">
            아직 일괄 처리 기록이 없어요. 실행하면 여기에 남고, 되돌리기도 여기서 합니다.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {jobs.map((job) => (
              <li key={job.jobId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <span
                  title={job.at}
                  className="shrink-0 whitespace-nowrap text-xs text-gray-700 tabular-nums"
                >
                  {jobTime(job.at)}
                </span>
                <span className="min-w-0 flex-1 text-sm break-keep text-brown">
                  {job.source === "list" && <span className="text-gray-700">현재 목록 기준 · </span>}
                  {job.summary}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-gray-700 tabular-nums">{job.count}건</span>
                {job.reverted ? (
                  <span
                    title={typeof job.reverted === "string" ? job.reverted : undefined}
                    className="shrink-0 whitespace-nowrap text-xs text-gray-600"
                  >
                    되돌림 {typeof job.reverted === "string" ? jobTime(job.reverted) : ""}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRevertTarget(job)}
                    disabled={revertingId !== null}
                    className={`${BTN_SMALL} shrink-0 border-gray-300 text-gray-700 hover:border-brown`}
                  >
                    {revertingId === job.jobId && <Spinner />}
                    되돌리기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {asking && preview && (
        <ConfirmCancelDialog
          title={`${count}건을 ${ACTION_LABEL[action]} 처리할까요?`}
          lines={[conditionLine, `동작 ${ACTION_LABEL[action]}`, silent ? "알림 보내지 않음" : `알림톡 ${count}건 발송`]}
          notice="처리 뒤 아래 [최근 일괄 처리]에서 되돌릴 수 있어요. 발송된 알림톡은 되돌려도 취소되지 않습니다."
          confirmLabel={`${count}건 ${ACTION_LABEL[action]}`}
          tone={action === "cancel" ? "danger" : "primary"}
          onClose={() => setAsking(false)}
          onConfirm={() => {
            const jobId = preview.data.jobId;
            setAsking(false);
            void doRun(jobId);
          }}
        />
      )}

      {revertTarget && (
        <ConfirmCancelDialog
          title="이 일괄 처리를 되돌릴까요?"
          lines={[`${revertTarget.at} · ${revertTarget.summary}`, `${revertTarget.count}건이 처리 전 상태로 돌아갑니다`]}
          notice="상태와 알림 기록을 처리 직전 값으로 되돌립니다. 되돌리기 자체는 알림을 보내지 않아요."
          confirmLabel="되돌리기"
          tone="primary"
          onClose={() => setRevertTarget(null)}
          onConfirm={() => {
            const job = revertTarget;
            setRevertTarget(null);
            void doRevert(job);
          }}
        />
      )}
    </section>
  );
}
