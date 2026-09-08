"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDigest } from "@/lib/digest";
import AdminShell from "./_components/AdminShell";
import Banner from "./_components/Banner";
import { useToasts } from "./_components/Toast";
import { useAdminApi } from "./_components/useAdminApi";
import {
  BTN_PRIMARY,
  CARD,
  FIELD,
  registerRowRefs,
  rowKey,
  rowRef,
  type AdminActions,
  type DateRange,
  type Row,
  type RowRef,
  type SheetKind,
  type StatusAction,
} from "./_components/shared";

const PW_KEY = "koinonia-admin-pw";

/** 6.1 계약 — meta·retreatMeta·openMeta는 rows와 같은 순서의 시트 행 번호 */
type BookingsResponse = {
  rows?: Row[];
  retreats?: Row[];
  openStays?: Row[];
  meta?: RowRef[];
  retreatMeta?: RowRef[];
  openMeta?: RowRef[];
};

type LoadResult =
  | { kind: "ok"; json: BookingsResponse }
  | { kind: "unauthorized" }
  | { kind: "error" }
  | { kind: "offline" };

/** 알림 결과를 사람이 읽는 한 줄로 */
function notifySuffix(notify: unknown): string {
  const n = notify as { guest?: unknown; guestSkipReason?: unknown } | undefined;
  const guest = n?.guest;
  if (guest === "ok") return " · 게스트 알림톡 발송됨";
  if (guest === "skipped") {
    // 6.1에서 "연락처 없음"처럼 사유가 함께 오면 그대로 보여준다
    const r = n?.guestSkipReason;
    const reason = typeof r === "string" && r ? r : "템플릿 미설정";
    return ` · 알림 건너뜀 (${reason})`;
  }
  if (guest && typeof guest === "object" && "error" in guest) {
    return ` · 알림 실패: ${(guest as { error: string }).error}`;
  }
  return "";
}

const ACTION_LABEL: Record<StatusAction, string> = {
  confirm: "입금확인",
  cancel: "취소",
  reopen: "되돌리기",
};

/** 토스트 첫머리에 붙는 사람 이름 (예약은 C열, 리트릿·무료개방은 B열) */
function personOf(sheet: SheetKind, row: Row): string {
  return (sheet === "booking" ? row[2] : row[1]) || "이름 없음";
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [pwInput, setPwInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  // 헤더 행을 포함한 원본 (buildDigest가 내부에서 slice(1) 한다)
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [rawRetreats, setRawRetreats] = useState<Row[]>([]);
  const [openStays, setOpenStays] = useState<Row[]>([]);
  const [airbnbRanges, setAirbnbRanges] = useState<Record<string, DateRange[]>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // 실패한 행을 2초만 강조한다. 무엇이 왜 실패했는지는 토스트가 말한다.
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toasts = useToasts();
  const { push } = toasts;

  const logout = useCallback(() => {
    setAuthed(false);
    setPassword("");
    setPwInput("");
    setRawRows([]);
    setRawRetreats([]);
    setOpenStays([]);
    setErrorKey(null);
    try {
      sessionStorage.removeItem(PW_KEY);
    } catch {
      /* private mode 등에서 접근이 막혀도 화면 동작에는 영향이 없다 */
    }
  }, []);

  const onUnauthorized = useCallback(() => {
    setExpired(true);
    logout();
  }, [logout]);

  const apiFetch = useAdminApi(password, onUnauthorized);

  /** 실패 토스트 + 그 행 2초 강조 */
  const failRow = useCallback(
    (key: string, text: string, onRetry: () => void) => {
      push({ kind: "error", text, onRetry });
      setErrorKey(key);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setErrorKey(null), 2000);
    },
    [push]
  );

  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
  }, []);

  /** 시트 데이터를 받아오기만 한다 (state 변경 없음) */
  const fetchAll = useCallback(async (pw: string): Promise<LoadResult> => {
    try {
      const res = await fetch("/api/admin/bookings", { headers: { "x-admin-password": pw } });
      if (res.status === 401) return { kind: "unauthorized" };
      if (!res.ok) return { kind: "error" };
      return { kind: "ok", json: (await res.json()) as BookingsResponse };
    } catch {
      return { kind: "offline" };
    }
  }, []);

  /**
   * 받은 행에 시트 행 번호(6.1의 meta)를 먼저 붙이고 state에 넣는다.
   * 상태 변경·재발송은 이 ref로 행을 찍어 보내므로, 연락처·신청일시가 빈 행도 처리된다.
   */
  const applyResult = useCallback((r: LoadResult) => {
    if (r.kind === "ok") {
      const rows = r.json.rows ?? [];
      const retreats = r.json.retreats ?? [];
      const opens = r.json.openStays ?? [];
      registerRowRefs(rows, r.json.meta);
      registerRowRefs(retreats, r.json.retreatMeta);
      registerRowRefs(opens, r.json.openMeta);
      setRawRows(rows);
      setRawRetreats(retreats);
      setOpenStays(opens.slice(1));
      setAuthed(true);
      setLoginError("");
      setError("");
      return;
    }
    if (r.kind === "unauthorized") {
      setAuthed(false);
      setLoginError("비밀번호가 맞지 않아요.");
      return;
    }
    setError(r.kind === "offline" ? "서버에 연결하지 못했어요." : "데이터를 불러오지 못했어요.");
  }, []);

  const load = useCallback(
    async (pw: string) => {
      setLoading(true);
      setError("");
      const r = await fetchAll(pw);
      applyResult(r);
      setLoading(false);
      return r.kind === "ok";
    },
    [fetchAll, applyResult]
  );

  // 탭이 열려 있는 동안만 유지되는 세션 (sessionStorage).
  // 첫 setState가 await 뒤에 오도록 해서 렌더 중 연쇄 업데이트를 만들지 않는다.
  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(PW_KEY) ?? "";
    } catch {
      saved = "";
    }
    if (!saved) return;
    let alive = true;
    void (async () => {
      const r = await fetchAll(saved);
      if (!alive) return;
      if (r.kind === "ok") {
        setPassword(saved);
        setPwInput(saved);
      }
      applyResult(r);
    })();
    return () => {
      alive = false;
    };
  }, [fetchAll, applyResult]);

  // 캘린더 + 오늘 탭 이중예약 배너용
  useEffect(() => {
    if (!authed) return;
    fetch("/api/availability")
      .then((r) => r.json())
      .then((d) => setAirbnbRanges(d as Record<string, DateRange[]>))
      .catch(() => setAirbnbRanges({}));
  }, [authed]);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpired(false);
    const ok = await load(pwInput);
    if (ok) {
      setPassword(pwInput);
      try {
        sessionStorage.setItem(PW_KEY, pwInput);
      } catch {
        /* 저장이 막혀도 이번 세션 동안은 state로 동작한다 */
      }
    }
  };

  const changeStatus = useCallback(
    // 이름 있는 함수 표현식 — 실패 토스트의 [다시 시도]가 자기 자신을 그대로 다시 부른다
    async function run(sheet: SheetKind, row: Row, action: StatusAction, reason?: string) {
      const key = rowKey(sheet, row);
      const label = ACTION_LABEL[action];
      setBusyKey(key);
      const res = await apiFetch("/api/admin/status", {
        method: "POST",
        // ref가 있으면 서버가 시트 행 번호로 직접 찾는다 (6.1). 없으면 서버가 예전 방식으로 떨어진다.
        body: JSON.stringify({ sheet, row, action, reason, ref: rowRef(row) }),
      });
      const d = (res.data ?? {}) as { ok?: boolean; status?: string; error?: string; notify?: unknown };
      setBusyKey(null);
      if (res.ok && d.ok) {
        push({
          kind: "ok",
          text: `${personOf(sheet, row)} · ${d.status ?? label} 완료${notifySuffix(d.notify)}`,
        });
        await load(password);
      } else {
        failRow(key, `${label} 실패 — ${d.error ?? `처리하지 못했어요 (${res.status})`}`, () =>
          void run(sheet, row, action, reason)
        );
      }
    },
    [apiFetch, load, password, push, failRow]
  );

  const resend = useCallback(
    async function run(row: Row) {
      const key = rowKey("booking", row);
      setBusyKey(key);
      const res = await apiFetch("/api/admin/resend", {
        method: "POST",
        body: JSON.stringify({ row, ref: rowRef(row) }),
      });
      const d = (res.data ?? {}) as { ok?: boolean; error?: string; notify?: unknown };
      setBusyKey(null);
      if (res.ok && d.ok) {
        push({ kind: "ok", text: `${personOf("booking", row)} · 재발송 완료${notifySuffix(d.notify)}` });
        await load(password);
      } else {
        failRow(key, `재발송 실패 — ${d.error ?? `처리하지 못했어요 (${res.status})`}`, () => void run(row));
      }
    },
    [apiFetch, load, password, push, failRow]
  );

  const actions: AdminActions = useMemo(
    () => ({ busyKey, errorKey, changeStatus, resend }),
    [busyKey, errorKey, changeStatus, resend]
  );

  const digest = useMemo(() => buildDigest(rawRows, rawRetreats), [rawRows, rawRetreats]);
  const rows = useMemo(() => rawRows.slice(1), [rawRows]);
  const retreats = useMemo(() => rawRetreats.slice(1), [rawRetreats]);

  if (!authed) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className={`${CARD} w-full max-w-sm`}>
          <h1 className="mb-1 whitespace-nowrap text-xl font-light text-brown">코이노니아 어드민</h1>
          <p className="mb-6 text-xs text-gray-700">운영자 전용 화면이에요.</p>

          {expired && (
            <div className="mb-4">
              <Banner tone="warn" title="세션이 끝났어요" detail="비밀번호를 다시 입력해주세요." />
            </div>
          )}

          <form onSubmit={submitLogin} className="space-y-3">
            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium text-gray-700">
                비밀번호
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                required
                className={FIELD}
              />
            </div>
            {loginError && (
              <p role="alert" className="rounded-lg bg-orange/10 px-3 py-2 text-sm break-keep text-brown">
                {loginError}
              </p>
            )}
            <button type="submit" disabled={loading} className={`${BTN_PRIMARY} w-full`}>
              {loading ? "확인 중…" : "로그인"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      digest={digest}
      rawRows={rawRows}
      rows={rows}
      retreats={retreats}
      openStays={openStays}
      airbnbRanges={airbnbRanges}
      actions={actions}
      apiFetch={apiFetch}
      loading={loading}
      error={error}
      onRefresh={() => load(password)}
      onLogout={logout}
      toasts={toasts}
    />
  );
}
