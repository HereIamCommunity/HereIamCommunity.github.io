"use client";

import { useState, useEffect, useMemo } from "react";

type Row = string[];
type Period = "오늘" | "이번 주" | "이번 달" | "전체";
type TypeFilter = "전체" | "살롱" | "스테이";

// row[0] = "2025. 6. 19. 오전 10:00:00" (ko-KR locale)
function parseRowDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    // "2025. 6. 19. 오전 10:00:00" — 정규식으로 정확히 파싱
    const m = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}):(\d{2})/);
    if (m) {
      let h = parseInt(m[5]);
      if (m[4] === "오후" && h < 12) h += 12;
      if (m[4] === "오전" && h === 12) h = 0;
      return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), h, parseInt(m[6]), parseInt(m[7]));
    }
    // fallback
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function getKSTNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function inPeriod(date: Date | null, period: Period): boolean {
  if (period === "전체") return true;
  if (!date) return false;
  const now = getKSTNow();
  const d = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

  if (period === "오늘") {
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }
  if (period === "이번 주") {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return d >= startOfWeek;
  }
  if (period === "이번 달") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return true;
}

// 월별 집계 (최근 6개월)
function getMonthlyStats(rows: Row[]) {
  const map: Record<string, { count: number; amount: number; salon: number; stay: number }> = {};
  rows.forEach((row) => {
    if (row[13] === "취소") return; // 취소 건 제외
    const d = parseRowDate(row[0]);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map[key]) map[key] = { count: 0, amount: 0, salon: 0, stay: 0 };
    map[key].count++;
    // 입금확인 건만 금액 합산
    if (row[13] === "입금확인") {
      map[key].amount += parseInt(row[11]?.replace(/[^0-9]/g, "") ?? "0") || 0;
    }
    if (row[1] === "살롱") map[key].salon++;
    else map[key].stay++;
  });
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .reverse();
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 최근 7일 일별 집계
function getDailyStats(rows: Row[]) {
  const map: Record<string, { count: number; amount: number }> = {};
  const now = getKSTNow();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    map[key] = { count: 0, amount: 0 };
  }
  rows.forEach((row) => {
    if (row[13] === "취소") return; // 취소 건 제외
    const d = parseRowDate(row[0]);
    if (!d) return;
    // 날짜(자정 기준) 차이 계산
    const msInDay = 86400000;
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.floor((nowMidnight - dMidnight) / msInDay);
    if (diffDays < 0 || diffDays > 6) return;
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (map[key]) {
      map[key].count++;
      map[key].amount += parseInt(row[11]?.replace(/[^0-9]/g, "") ?? "0") || 0;
    }
  });
  return Object.entries(map);
}

type RowMsg = { ok: boolean; text: string };

function rowKey(row: Row) {
  return `${row[0] ?? ""}|${row[3] ?? ""}`;
}

function sendResultLabel(r: unknown): string {
  if (r === "ok") return "성공";
  if (r === "skipped") return "건너뜀";
  if (r && typeof r === "object" && "error" in r) return `실패 (${(r as { error: string }).error})`;
  return "-";
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("전체");
  const [period, setPeriod] = useState<Period>("전체");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"목록" | "통계" | "스테이" | "리트릿" | "무료개방">("목록");
  const [retreats, setRetreats] = useState<Row[]>([]);
  const [openStays, setOpenStays] = useState<Row[]>([]);
  const [airbnbRanges, setAirbnbRanges] = useState<Record<string, { start: string; end: string }[]>>({});
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calRoom, setCalRoom] = useState<"nagnae" | "oksun" | "yeutae">("nagnae");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, RowMsg>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<RowMsg | null>(null);

  useEffect(() => {
    if (tab === "스테이" && authed) {
      fetch("/api/availability")
        .then(r => r.json())
        .then(d => setAirbnbRanges(d))
        .catch(() => {});
    }
  }, [tab, authed]);

  const load = async (pw: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/bookings", {
        headers: { "x-admin-password": pw },
      });
      if (res.status === 401) { setError("비밀번호가 틀렸습니다."); return; }
      if (!res.ok) { setError("데이터를 불러오지 못했습니다."); return; }
      const json = await res.json();
      setRows((json.rows ?? []).slice(1));
      setRetreats((json.retreats ?? []).slice(1));
      setOpenStays((json.openStays ?? []).slice(1));
      setAuthed(true);
    } catch {
      setError("서버 연결 오류");
    } finally {
      setLoading(false);
    }
  };

  const setMsg = (key: string, msg: RowMsg) =>
    setRowMsg((prev) => ({ ...prev, [key]: msg }));

  const notifySuffix = (notify: { guest?: unknown } | undefined) => {
    const guest = notify?.guest;
    if (guest === "ok") return " · 알림 발송됨";
    if (guest === "skipped") return " · 알림 건너뜀 (환경변수 미설정)";
    if (guest && typeof guest === "object" && "error" in guest) {
      return ` · 알림 실패: ${(guest as { error: string }).error}`;
    }
    return "";
  };

  const resend = async (row: Row) => {
    const key = rowKey(row);
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ row }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setMsg(key, { ok: true, text: `✅ 재발송 완료${notifySuffix(j.notify)}` });
        await load(password);
      } else {
        setMsg(key, { ok: false, text: `❌ 재발송 실패: ${j.error ?? res.status}` });
      }
    } catch (e) {
      setMsg(key, { ok: false, text: `❌ 오류: ${e}` });
    } finally {
      setBusyKey(null);
    }
  };

  const changeStatus = async (row: Row, action: "confirm" | "cancel") => {
    const key = rowKey(row);
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ row, action }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setMsg(key, { ok: true, text: `✅ ${j.status}${notifySuffix(j.notify)}` });
        await load(password);
      } else {
        setMsg(key, { ok: false, text: `❌ ${j.error ?? `실패 (${res.status})`}` });
      }
    } catch (e) {
      setMsg(key, { ok: false, text: `❌ 오류: ${e}` });
    } finally {
      setBusyKey(null);
    }
  };

  const runNotifyTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/notify-test", {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      const j = await res.json();
      const lines: string[] = [];
      if (j.error) lines.push(j.error);
      if (j.missingRequired?.length) lines.push(`필수 환경변수 누락: ${j.missingRequired.join(", ")}`);
      if (j.missingKakao?.length) lines.push(`알림톡 환경변수 누락: ${j.missingKakao.join(", ")}`);
      if (j.kakaoMode) lines.push(`발송 모드: ${j.kakaoMode}`);
      if (j.sentTo) lines.push(`수신번호: ${j.sentTo}`);
      if (j.result) {
        lines.push(`groupId: ${j.result.groupId ?? "-"}`);
        lines.push(`게스트: ${sendResultLabel(j.result.guest)} / 호스트: ${sendResultLabel(j.result.host)}`);
      }
      setTestResult({ ok: !!j.ok, text: lines.join("\n") || "응답 없음" });
    } catch (e) {
      setTestResult({ ok: false, text: `오류: ${e}` });
    } finally {
      setTesting(false);
    }
  };

  const filtered = useMemo(() => rows.filter((row) => {
    const matchType = typeFilter === "전체" || row[1] === typeFilter;
    const d = parseRowDate(row[0]);
    const matchPeriod = inPeriod(d, period);
    const matchSearch = !search ||
      row[2]?.includes(search) || row[3]?.includes(search) || row[4]?.includes(search);
    return matchType && matchPeriod && matchSearch;
  }), [rows, typeFilter, period, search]);

  const totalAmount = useMemo(() =>
    filtered.reduce((s, r) => s + (parseInt(r[11]?.replace(/[^0-9]/g, "") ?? "0") || 0), 0),
    [filtered]
  );

  const confirmedCount = filtered.filter(r => r[13] === "입금확인").length;
  const pendingCount = filtered.filter(r => !r[13] || r[13] === "신청").length;

  const monthlyStats = useMemo(() => getMonthlyStats(rows), [rows]);
  const dailyStats = useMemo(() => getDailyStats(rows), [rows]);
  const maxDailyCount = Math.max(...dailyStats.map(([, v]) => v.count), 1);
  const maxMonthlyAmount = Math.max(...monthlyStats.map(([, v]) => v.amount), 1);

  const ROOM_NAMES: Record<string, string> = { nagnae: "나그네방", oksun: "옥순방", yeutae: "여태방" };
  const stayRows = useMemo(() => rows.filter(r => r[1] === "스테이" && r[13] !== "취소"), [rows]);

  const getDayStatus = (dateStr: string, roomKey: string): "website" | "airbnb" | "both" | "available" => {
    const roomName = ROOM_NAMES[roomKey];
    const isWebsite = stayRows.some(r => r[6] === roomName && r[8] && r[9] && dateStr >= r[8] && dateStr < r[9]);
    const isAirbnb = (airbnbRanges[roomKey] ?? []).some(r => dateStr >= r.start && dateStr <= r.end);
    if (isWebsite && isAirbnb) return "both";
    if (isWebsite) return "website";
    if (isAirbnb) return "airbnb";
    return "available";
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-2">Admin</p>
            <h1 className="text-2xl font-light text-[#372a14]">코이노니아 어드민</h1>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); load(password); }} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#372a14] text-white font-semibold py-3 rounded-xl hover:bg-[#ff6b35] transition-colors disabled:opacity-60"
            >
              {loading ? "확인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] pt-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">

        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-1">Admin Dashboard</p>
            <h1 className="text-2xl font-light text-[#372a14]">코이노니아 어드민</h1>
          </div>
          <div className="flex gap-3 items-center">
            <span className="text-xs text-gray-400">{rows.length}건 전체</span>
            <button
              onClick={runNotifyTest}
              disabled={testing}
              className="text-sm text-[#ff6b35] border border-[#ff6b35]/40 px-4 py-2 rounded-full hover:border-[#ff6b35] transition-colors disabled:opacity-50"
            >
              {testing ? "발송중…" : "알림 테스트"}
            </button>
            <button
              onClick={() => load(password)}
              className="text-sm text-[#296973] border border-[#296973]/30 px-4 py-2 rounded-full hover:border-[#296973] transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 알림 테스트 결과 */}
        {testResult && (
          <div
            className={`mb-6 rounded-2xl border px-5 py-4 ${
              testResult.ok
                ? "border-green-200 bg-green-50/60"
                : "border-red-200 bg-red-50/60"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-medium mb-1 ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
                  {testResult.ok ? "알림 테스트 발송 완료" : "알림 테스트 실패"}
                </p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-5">{testResult.text}</pre>
              </div>
              <button
                onClick={() => setTestResult(null)}
                className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(["목록", "통계", "스테이", "리트릿", "무료개방"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-[#ff6b35] text-[#ff6b35]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "목록" && (
          <>
            {/* 기간 + 구분 필터 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(["오늘", "이번 주", "이번 달", "전체"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    period === p
                      ? "bg-[#372a14] text-white"
                      : "bg-white text-gray-500 border border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {p}
                </button>
              ))}
              <div className="w-px bg-gray-200 mx-1" />
              {(["전체", "살롱", "스테이"] as TypeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    typeFilter === f
                      ? f === "살롱"
                        ? "bg-[#ff6b35] text-white"
                        : f === "스테이"
                        ? "bg-[#296973] text-white"
                        : "bg-[#372a14] text-white"
                      : "bg-white text-gray-500 border border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { label: "신청", value: `${filtered.length}건`, color: "text-[#372a14]" },
                { label: "입금확인", value: `${confirmedCount}건`, color: "text-green-600" },
                { label: "입금대기", value: `${pendingCount}건`, color: "text-yellow-600" },
                { label: "결제 합계", value: `${totalAmount.toLocaleString()}원`, color: "text-[#ff6b35]" },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
                  <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                  <p className={`text-lg font-medium ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* 검색 */}
            <div className="flex gap-3 mb-5 items-center">
              <input
                type="text"
                placeholder="이름·연락처·프로그램 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-200 rounded-full px-4 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:border-[#372a14] bg-white"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-xs text-gray-400 hover:text-gray-600">
                  지우기
                </button>
              )}
            </div>

            {/* 테이블 */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["신청일시", "구분", "이름", "연락처", "프로그램/객실", "일시/체크인", "할인", "결제금액", "상태", "요청사항", "알림", "처리"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-16 text-gray-400 text-sm">
                        {period !== "전체" ? `${period} 신청 내역이 없습니다.` : "신청 내역이 없습니다."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row, i) => (
                      <tr key={`${rowKey(row)}-${i}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{row[0]}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            row[1] === "살롱"
                              ? "bg-[#ff6b35]/10 text-[#ff6b35]"
                              : "bg-[#296973]/10 text-[#296973]"
                          }`}>
                            {row[1]}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#372a14]">{row[2]}</td>
                        <td className="px-4 py-3 text-gray-600">{row[3]}</td>
                        <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">
                          {row[4] || row[6]}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {row[5] || (row[8] && `${row[8]} →`)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {row[10] !== "없음" ? row[10] : "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#ff6b35] whitespace-nowrap">
                          {parseInt(row[11] ?? "0").toLocaleString()}원
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            row[13] === "입금확인"
                              ? "bg-green-50 text-green-600"
                              : row[13] === "취소"
                              ? "bg-red-50 text-red-400"
                              : "bg-yellow-50 text-yellow-600"
                          }`}>
                            {row[13] || "신청"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate">
                          {row[12] || "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row[13] === "취소" ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : row[14]?.startsWith("✅") ? (
                            <span className="text-xs text-green-600">{row[14]}</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-red-500">
                                {row[14]?.startsWith("❌") ? "실패" : "미발송"}
                              </span>
                              <button
                                onClick={() => resend(row)}
                                disabled={busyKey === rowKey(row)}
                                className="text-xs px-2 py-0.5 rounded-full border border-[#ff6b35] text-[#ff6b35] hover:bg-[#ff6b35]/10 disabled:opacity-40"
                              >
                                {busyKey === rowKey(row) ? "처리중…" : "재발송"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1.5 min-w-[150px]">
                            <div className="flex gap-1.5">
                              {(row[13] || "신청") === "신청" && (
                                <button
                                  onClick={() => changeStatus(row, "confirm")}
                                  disabled={busyKey === rowKey(row)}
                                  className="text-xs px-2.5 py-1 rounded-full border border-green-500 text-green-600 hover:bg-green-50 disabled:opacity-40 whitespace-nowrap"
                                >
                                  {busyKey === rowKey(row) ? "처리중…" : "입금확인"}
                                </button>
                              )}
                              {(row[13] ?? "") !== "취소" && (
                                <button
                                  onClick={() => changeStatus(row, "cancel")}
                                  disabled={busyKey === rowKey(row)}
                                  className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
                                >
                                  {busyKey === rowKey(row) ? "처리중…" : "취소"}
                                </button>
                              )}
                              {(row[13] ?? "") === "취소" && (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </div>
                            {rowMsg[rowKey(row)] && (
                              <span
                                className={`text-xs leading-4 ${
                                  rowMsg[rowKey(row)].ok ? "text-green-600" : "text-red-500"
                                }`}
                              >
                                {rowMsg[rowKey(row)].text}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "통계" && (
          <div className="space-y-8">

            {/* 전체 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "전체 신청", value: `${rows.filter(r => r[13] !== "취소").length}건` },
                { label: "살롱", value: `${rows.filter(r => r[1] === "살롱" && r[13] !== "취소").length}건` },
                { label: "스테이", value: `${rows.filter(r => r[1] === "스테이" && r[13] !== "취소").length}건` },
                {
                  label: "총 입금액 (확인)",
                  value: `${rows.filter(r => r[13] === "입금확인").reduce((s, r) => s + (parseInt(r[11]?.replace(/[^0-9]/g, "") ?? "0") || 0), 0).toLocaleString()}원`,
                },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
                  <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                  <p className="text-xl font-light text-[#372a14]">{card.value}</p>
                </div>
              ))}
            </div>

            {/* 최근 7일 일별 신청 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-[#372a14] mb-6">최근 7일 일별 신청</h3>
              <div className="flex items-end gap-2 h-28">
                {dailyStats.map(([day, val]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">{val.count > 0 ? val.count : ""}</span>
                    <div className="w-full bg-[#faf9f7] rounded-t-md overflow-hidden" style={{ height: "72px" }}>
                      <div
                        className="w-full bg-[#ff6b35]/80 rounded-t-md transition-all duration-500"
                        style={{ height: `${(val.count / maxDailyCount) * 72}px`, marginTop: `${72 - (val.count / maxDailyCount) * 72}px` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 월별 통계 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-[#372a14] mb-6">월별 통계</h3>
              {monthlyStats.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">데이터가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {monthlyStats.map(([month, val]) => (
                    <div key={month} className="grid grid-cols-[80px_1fr_80px_80px_80px] gap-4 items-center text-sm">
                      <span className="text-gray-500 font-medium">{month}</span>
                      <div className="h-2 bg-[#faf9f7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#ff6b35]/70 rounded-full"
                          style={{ width: `${(val.amount / maxMonthlyAmount) * 100}%` }}
                        />
                      </div>
                      <span className="text-right text-gray-400 text-xs">{val.count}건</span>
                      <span className="text-right text-xs">
                        <span className="text-[#ff6b35]">살롱 {val.salon}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="text-[#296973]">스테이 {val.stay}</span>
                      </span>
                      <span className="text-right text-gray-600 text-xs font-medium">
                        {val.amount.toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 상태 분포 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-[#372a14] mb-4">예약 상태</h3>
                <div className="space-y-3">
                  {[
                    { label: "신청 (입금대기)", count: rows.filter(r => !r[13] || r[13] === "신청").length, color: "bg-yellow-400" },
                    { label: "입금확인", count: rows.filter(r => r[13] === "입금확인").length, color: "bg-green-400" },
                    { label: "취소", count: rows.filter(r => r[13] === "취소").length, color: "bg-red-300" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
                      <span className="text-sm text-gray-600 flex-1">{s.label}</span>
                      <span className="text-sm font-medium text-[#372a14]">{s.count}건</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-[#372a14] mb-4">할인 적용 현황</h3>
                <div className="space-y-3">
                  {[
                    { label: "일반", count: rows.filter(r => r[10] === "없음" || !r[10]).length },
                    { label: "멤버십 '곁'", count: rows.filter(r => r[10]?.includes("곁")).length },
                    { label: "나그네방 후원자", count: rows.filter(r => r[10]?.includes("나그네")).length },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{s.label}</span>
                      <span className="font-medium text-[#372a14]">{s.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── 스테이 탭 ── */}
        {tab === "스테이" && (
          <div className="space-y-6">
            {/* 방 선택 */}
            <div className="flex gap-2 flex-wrap">
              {(["nagnae", "oksun", "yeutae"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setCalRoom(key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    calRoom === key
                      ? "bg-[#296973] text-white"
                      : "bg-white text-gray-500 border border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {ROOM_NAMES[key]}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* 캘린더 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                    className="p-1 text-gray-400 hover:text-[#ff6b35] transition-colors text-lg"
                  >←</button>
                  <h3 className="text-sm font-medium text-[#372a14]">{calYear}년 {calMonth + 1}월</h3>
                  <button
                    onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                    className="p-1 text-gray-400 hover:text-[#ff6b35] transition-colors text-lg"
                  >→</button>
                </div>

                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 mb-1">
                  {["일","월","화","수","목","금","토"].map(d => (
                    <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
                  ))}
                </div>

                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7 gap-0.5">
                  {(() => {
                    const firstDay = new Date(calYear, calMonth, 1).getDay();
                    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                    const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                    const cells: (number | null)[] = [];
                    for (let i = 0; i < firstDay; i++) cells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                    while (cells.length % 7 !== 0) cells.push(null);
                    return cells.map((day, idx) => {
                      if (!day) return <div key={idx} />;
                      const dateStr = toDateStr(calYear, calMonth, day);
                      const status = getDayStatus(dateStr, calRoom);
                      const isToday = dateStr === todayStr;
                      const isPast = dateStr < todayStr;
                      let bg = "hover:bg-gray-50";
                      let text = isPast ? "text-gray-300" : "text-gray-700";
                      if (status === "website") { bg = "bg-[#296973]"; text = "text-white"; }
                      else if (status === "airbnb") { bg = "bg-[#ff6b35]"; text = "text-white"; }
                      else if (status === "both") { bg = "bg-red-500"; text = "text-white"; }
                      return (
                        <div key={idx} className={`aspect-square flex items-center justify-center text-xs rounded-md ${bg} ${text} ${isToday && status === "available" ? "ring-1 ring-[#ff6b35] font-bold" : ""}`}>
                          {day}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* 범례 */}
                <div className="flex gap-4 mt-4 text-xs text-gray-500 flex-wrap">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#296973]" />웹사이트</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#ff6b35]" />에어비앤비</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" />중복 주의</div>
                </div>
              </div>

              {/* 예약 목록 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-medium text-[#372a14] mb-4">{ROOM_NAMES[calRoom]} 예약 목록</h3>
                {(() => {
                  const roomName = ROOM_NAMES[calRoom];
                  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                  const webBookings = stayRows
                    .filter(r => r[6] === roomName && r[9] >= todayStr)
                    .sort((a, b) => (a[8] ?? "").localeCompare(b[8] ?? ""));
                  const airbnbBookings = (airbnbRanges[calRoom] ?? [])
                    .filter(r => r.end >= todayStr)
                    .sort((a, b) => a.start.localeCompare(b.start));

                  if (webBookings.length === 0 && airbnbBookings.length === 0) {
                    return <p className="text-gray-400 text-sm text-center py-8">예약 없음</p>;
                  }
                  return (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {webBookings.map((row, i) => (
                        <div key={`web-${i}`} className="flex items-start gap-3 p-3 rounded-xl bg-[#296973]/5 border border-[#296973]/10">
                          <div className="w-2 h-2 rounded-full bg-[#296973] shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#372a14]">{row[2]}</p>
                            <p className="text-xs text-gray-500">{row[8]} ~ {row[9]} · {row[3]}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            row[13] === "입금확인" ? "bg-green-100 text-green-700" : "bg-yellow-50 text-yellow-600"
                          }`}>{row[13] || "신청"}</span>
                        </div>
                      ))}
                      {airbnbBookings.map((r, i) => (
                        <div key={`ab-${i}`} className="flex items-start gap-3 p-3 rounded-xl bg-[#ff6b35]/5 border border-[#ff6b35]/10">
                          <div className="w-2 h-2 rounded-full bg-[#ff6b35] shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700">에어비앤비 예약</p>
                            <p className="text-xs text-gray-500">{r.start} ~ {r.end}</p>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-orange-50 text-orange-600">에어비앤비</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* 전체 방 요약 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-[#372a14] mb-4">전체 방 현황 (다음 30일)</h3>
              <div className="grid grid-cols-3 gap-4">
                {(["nagnae", "oksun", "yeutae"] as const).map(key => {
                  const todayStr = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                  const in30 = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 30);
                  const roomName = ROOM_NAMES[key];
                  const webCnt = stayRows.filter(r => r[6] === roomName && r[9] >= todayStr && r[8] <= in30).length;
                  const abCnt = (airbnbRanges[key] ?? []).filter(r => r.end >= todayStr && r.start <= in30).length;
                  return (
                    <div key={key} className="text-center p-4 bg-[#faf9f7] rounded-xl">
                      <p className="text-xs text-gray-500 mb-2">{roomName}</p>
                      <div className="flex justify-center gap-3 text-sm">
                        <span className="text-[#296973] font-medium">{webCnt}건</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-[#ff6b35] font-medium">{abCnt}건</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">웹 | 에어비앤비</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 무료개방 탭 ── */}
        {tab === "무료개방" && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "전체 신청", value: `${openStays.length}건` },
                { label: "확정", value: `${openStays.filter(r => r[11] === "확정").length}건` },
                { label: "검토 중", value: `${openStays.filter(r => !r[11] || r[11] === "신청").length}건` },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
                  <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                  <p className="text-xl font-light text-[#372a14]">{c.value}</p>
                </div>
              ))}
            </div>
            {openStays.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">아직 신청이 없어요.</div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {["신청일시","이름","연락처","이메일","체크인","체크아웃","형태","인원","방문이유","기여방법","응원메시지","상태"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {openStays.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{row[0]}</td>
                          <td className="px-4 py-3 font-medium text-[#372a14] whitespace-nowrap">{row[1]}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row[2]}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row[3]}</td>
                          <td className="px-4 py-3 text-[#296973] font-medium whitespace-nowrap">{row[4]}</td>
                          <td className="px-4 py-3 text-[#296973] font-medium whitespace-nowrap">{row[5]}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{row[6]}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 text-center">{row[7]}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{row[8]}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#ff6b35]/10 text-[#ff6b35] font-medium">{row[9]}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs max-w-[140px] truncate italic">{row[10]}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              row[11] === "확정" ? "bg-green-100 text-green-700" : "bg-yellow-50 text-yellow-700"
                            }`}>{row[11] || "신청"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center mt-4">상태 변경(확정 처리 등)은 구글 시트에서 직접 수정해주세요.</p>
          </div>
        )}

        {/* ── 리트릿 탭 ── */}
        {tab === "리트릿" && (
          <div>
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {["s1","s2","s3","s4","s5"].map((sid, i) => {
                const labels = ["1회차 7/3-5","2회차 7/24-26","3회차 7/30-8/1","4회차 8/15-17","5회차 8/21-23"];
                const cnt = retreats.filter(r => r[5]?.includes(labels[i].split(" ")[0])).length;
                const full = cnt >= 6;
                return (
                  <div key={sid} className={`bg-white rounded-xl p-4 border ${full ? "border-red-200" : "border-gray-100"}`}>
                    <p className="text-xs text-gray-400 mb-1">{labels[i]}</p>
                    <p className={`text-2xl font-bold ${full ? "text-red-500" : "text-[#372a14]"}`}>{cnt}<span className="text-sm font-normal text-gray-400">/6</span></p>
                    {full && <p className="text-[10px] text-red-400 mt-1">마감</p>}
                  </div>
                );
              })}
            </div>

            {/* 신청 목록 */}
            {retreats.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">아직 리트릿 신청이 없어요.</div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {["신청일시","이름","연락처","학년","지역","회차","추천인","궁금한점","요청사항","알레르기","케어사항","부모님메모","상태"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {retreats.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{row[0]}</td>
                          <td className="px-4 py-3 font-medium text-[#372a14] whitespace-nowrap">{row[1]}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row[2]}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row[3]}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row[4]}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="bg-[#ff6b35]/10 text-[#ff6b35] text-xs px-2 py-0.5 rounded-full font-medium">{row[5]}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{row[6]}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{row[7]}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{row[8]}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{row[9]}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{row[10]}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{row[11]}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row[12] === "입금확인" ? "bg-green-100 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                              {row[12] || row[9] || "신청"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
