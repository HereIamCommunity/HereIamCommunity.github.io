"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDigest } from "@/lib/digest";
import AdminShell from "./_components/AdminShell";
import Banner from "./_components/Banner";
import { useAdminApi } from "./_components/useAdminApi";
import {
  BTN_PRIMARY,
  rowKey,
  type AdminActions,
  type DateRange,
  type Row,
  type RowMsg,
  type SheetKind,
  type StatusAction,
} from "./_components/shared";

const PW_KEY = "koinonia-admin-pw";

type BookingsResponse = { rows?: Row[]; retreats?: Row[]; openStays?: Row[] };

type LoadResult =
  | { kind: "ok"; json: BookingsResponse }
  | { kind: "unauthorized" }
  | { kind: "error" }
  | { kind: "offline" };

/** 알림 결과를 사람이 읽는 한 줄로 */
function notifySuffix(notify: unknown): string {
  const guest = (notify as { guest?: unknown } | undefined)?.guest;
  if (guest === "ok") return " · 알림 발송됨";
  if (guest === "skipped") return " · 알림 건너뜀 (환경변수 미설정)";
  if (guest && typeof guest === "object" && "error" in guest) {
    return ` · 알림 실패: ${(guest as { error: string }).error}`;
  }
  return "";
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
  const [rowMsg, setRowMsg] = useState<Record<string, RowMsg>>({});
  const msgTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const logout = useCallback(() => {
    setAuthed(false);
    setPassword("");
    setPwInput("");
    setRawRows([]);
    setRawRetreats([]);
    setOpenStays([]);
    setRowMsg({});
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

  const setMsg = useCallback((key: string, msg: RowMsg) => {
    setRowMsg((prev) => ({ ...prev, [key]: msg }));
    clearTimeout(msgTimers.current[key]);
    msgTimers.current[key] = setTimeout(() => {
      setRowMsg((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 6000);
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

  const applyResult = useCallback((r: LoadResult) => {
    if (r.kind === "ok") {
      setRawRows(r.json.rows ?? []);
      setRawRetreats(r.json.retreats ?? []);
      setOpenStays((r.json.openStays ?? []).slice(1));
      setRowMsg({});
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
    async (sheet: SheetKind, row: Row, action: StatusAction, reason?: string) => {
      const key = rowKey(sheet, row);
      setBusyKey(key);
      const res = await apiFetch("/api/admin/status", {
        method: "POST",
        body: JSON.stringify({ sheet, row, action, reason }),
      });
      const d = (res.data ?? {}) as { ok?: boolean; status?: string; error?: string; notify?: unknown };
      if (res.ok && d.ok) {
        setMsg(key, { ok: true, text: `${d.status ?? "처리 완료"}${notifySuffix(d.notify)}` });
        await load(password);
      } else {
        setMsg(key, { ok: false, text: d.error ?? `처리하지 못했어요 (${res.status})` });
      }
      setBusyKey(null);
    },
    [apiFetch, load, password, setMsg]
  );

  const resend = useCallback(
    async (row: Row) => {
      const key = rowKey("booking", row);
      setBusyKey(key);
      const res = await apiFetch("/api/admin/resend", { method: "POST", body: JSON.stringify({ row }) });
      const d = (res.data ?? {}) as { ok?: boolean; error?: string; notify?: unknown };
      if (res.ok && d.ok) {
        setMsg(key, { ok: true, text: `재발송 완료${notifySuffix(d.notify)}` });
        await load(password);
      } else {
        setMsg(key, { ok: false, text: `재발송 실패: ${d.error ?? res.status}` });
      }
      setBusyKey(null);
    },
    [apiFetch, load, password, setMsg]
  );

  const actions: AdminActions = useMemo(
    () => ({ busyKey, rowMsg, changeStatus, resend }),
    [busyKey, rowMsg, changeStatus, resend]
  );

  const digest = useMemo(() => buildDigest(rawRows, rawRetreats), [rawRows, rawRetreats]);
  const rows = useMemo(() => rawRows.slice(1), [rawRows]);
  const retreats = useMemo(() => rawRetreats.slice(1), [rawRetreats]);

  if (!authed) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8">
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
                className="min-h-[44px] w-full rounded-lg border border-gray-300 px-4 text-sm text-brown"
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
    />
  );
}
