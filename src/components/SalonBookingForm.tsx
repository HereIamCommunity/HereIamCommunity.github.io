"use client";

import { useState, useCallback, useEffect } from "react";
import {
  type Program,
  type ProgramType,
  PROGRAMS,
  FESTIVAL_DAYS,
  festivalDayLabel,
  buildSlots,
  countKey,
  festivalCalendar,
  programsOnDay,
} from "@/lib/programs";

type Step = "select" | "info" | "done";

/** 선택 단계에서 프로그램을 묶는 소제목 + 색. 페이지마다 다르게 넘긴다. */
export type ProgramGroup = {
  type: ProgramType;
  label: string;
  labelClass: string;
  priceClass: string;
};

export const SALON_GROUPS: ProgramGroup[] = [
  { type: "potluck", label: "Wednesday Potluck", labelClass: "text-[#296973]", priceClass: "text-[#296973]" },
  { type: "friday",  label: "Friday Night",      labelClass: "text-[#ff6b35]", priceClass: "text-[#ff6b35]" },
  { type: "special", label: "Someday Salons",    labelClass: "text-[#372a14]", priceClass: "text-[#372a14]" },
];

type Props = {
  programs?: Program[];
  groups?: ProgramGroup[];
  heading?: string;
  description?: string;
  /**
   * 1단계에서 고르는 방식.
   * "list"     — 그룹별 목록 (살롱)
   * "calendar" — 축제 달력에서 날짜를 먼저 고른다 (탈춤축제)
   */
  mode?: "list" | "calendar";
};

export default function SalonBookingForm({
  programs = PROGRAMS,
  groups = SALON_GROUPS,
  heading = "프로그램 신청",
  description = "참가할 프로그램과 날짜를 선택하세요.",
  mode = "list",
}: Props) {
  const [step, setStep] = useState<Step>("select");
  const [selectedId, setSelectedId] = useState<string>("");
  const [visitDate, setVisitDate] = useState<string>("");
  const [slot, setSlot] = useState<string>("");
  const [calendarDay, setCalendarDay] = useState<string>("");
  const [discount, setDiscount] = useState<"none" | "geot">("none");
  const [form, setForm] = useState({ name: "", phone: "", email: "", memo: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [copied, setCopied] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/program-counts")
      .then((r) => r.json())
      .then((d) => setCounts(d.counts ?? {}))
      .catch(() => {});
  }, []);

  /** 특정 '일시' 한 칸의 잔여 인원. 정원이 없으면 null. */
  const remainingFor = (p: Program, dateLabel: string) => {
    if (!p.capacity) return null;
    const booked = counts[countKey(p.title, dateLabel)] ?? 0;
    return Math.max(0, p.capacity - booked);
  };

  /**
   * 목록(1단계)에 띄울 잔여. 상시 프로그램은 어느 날 오느냐에 따라 달라지므로
   * 여기서는 세지 않고, 날짜·시간대를 고른 뒤 2단계에서 보여준다.
   */
  const getRemaining = (p: Program) =>
    p.pickDate ? null : remainingFor(p, p.dateLabel);

  const today = new Date().toISOString().slice(0, 10);
  const isPastProgram = (p: Program) => p.date < today;

  const program = programs.find((p) => p.id === selectedId);

  // 상시 프로그램은 dateLabel("축제기간 상시 · 14:00–18:00")의 시간대만 살리고
  // 앞의 날짜를 신청자가 고른 날로 바꿔 시트·알림톡에 보낸다.
  const openTimeLabel = program?.dateLabel.split("·").pop()?.trim() ?? "";
  const visitDayLabel = visitDate ? festivalDayLabel(visitDate) : "";
  const slotList = program?.slots ? buildSlots(program.slots) : [];

  const bookingDate = !program
    ? ""
    : !program.pickDate
      ? program.dateLabel
      : !visitDayLabel
        ? ""
        : program.slots
          ? slot
            ? `${visitDayLabel} ${slot}`
            : ""
          : `${visitDayLabel} ${openTimeLabel}`.trim();

  /** 고른 일시의 잔여 — 2단계에서 보여주고, 제출 직전에 한 번 더 막는다. */
  const remainingNow =
    program && bookingDate ? remainingFor(program, bookingDate) : null;

  /** 상시 프로그램의 방문일 선택지 — 지난 날짜는 뺀다. */
  const visitDayOptions = FESTIVAL_DAYS.filter((d) => d >= today);

  const isMember = discount === "geot";
  const discountAmount = isMember && program ? program.price : 0;
  const totalAmount = program ? program.price - discountAmount : 0;

  const copyAccount = useCallback(() => {
    navigator.clipboard.writeText("5539-10-13844507");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleNext = () => {
    if (!selectedId) { setError("참가할 프로그램을 선택해주세요."); return; }
    setError("");
    setStep("info");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) { setError("이름과 연락처를 입력해주세요."); return; }
    if (program?.pickDate && !visitDate) { setError("방문하실 날짜를 선택해주세요."); return; }
    if (program?.slots && !slot) { setError("방문하실 시간대를 선택해주세요."); return; }
    if (remainingNow === 0) { setError("방금 마감되었습니다. 다른 날짜나 시간대를 선택해주세요."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "salon",
          program: program?.title,
          date: bookingDate,
          totalAmount,
          discount,
          ...form,
        }),
      });
      if (res.ok) {
        setStep("done");
      } else if (res.status === 409) {
        // 서버가 마감을 다시 확인해 거절한 경우 — 최신 집계로 화면을 갱신한다.
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? "방금 마감되었습니다. 다른 날짜나 시간대를 선택해주세요.");
        fetch("/api/program-counts")
          .then((r) => r.json())
          .then((d) => setCounts(d.counts ?? {}))
          .catch(() => {});
        setSlot("");
      } else {
        setError("신청 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    } catch {
      setError("서버 연결 오류. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  /* ─────────── 완료 화면 ─────────── */
  if (step === "done") {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-[#372a14] mb-2">참가 확정!</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            코이노니아에서 함께할 날을 기다리고 있을게요.
          </p>
        </div>

        {/* 확정 안내 */}
        <div className="bg-[#296973]/10 border border-[#296973]/20 rounded-xl px-5 py-4 mb-6">
          {isMember ? (
            <>
              <p className="text-sm font-semibold text-[#296973] mb-1">멤버십 '곁' — 무료 참가</p>
              <p className="text-sm text-[#296973]/80 leading-relaxed">
                별도 입금 없이 당일 코이노니아에 오시면 됩니다.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#296973] mb-1">신청 즉시 참가가 확정됩니다</p>
              <p className="text-sm text-[#296973]/80 leading-relaxed">
                코이노니아 살롱은 별도 안내 메시지를 드리지 않습니다.<br />
                약속한 시간에 편히 방문해 주세요.
              </p>
            </>
          )}
        </div>

        {/* 신청 내역 */}
        <div className="bg-[#fffbde] rounded-xl p-5 mb-5 text-sm">
          <p className="font-bold text-[#372a14] mb-3">신청 내역</p>
          <div className="space-y-2 text-gray-600">
            <div className="flex justify-between">
              <span className="text-gray-400">프로그램</span>
              <span className="font-medium text-[#372a14]">{program?.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">일시</span>
              <span className="font-medium text-[#372a14]">{bookingDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">신청자</span>
              <span className="font-medium text-[#372a14]">{form.name}</span>
            </div>
            {isMember && (
              <div className="flex justify-between text-[#296973]">
                <span>멤버십 &#39;곁&#39; — 무료 참가</span>
                <span>−{discountAmount.toLocaleString()}원</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-[#ff6b35] text-base pt-2 border-t border-yellow-200 mt-1">
              <span>최종 입금액</span>
              <span>{totalAmount === 0 ? "무료" : `${totalAmount.toLocaleString()}원`}</span>
            </div>
          </div>
        </div>

        {/* 계좌 — 멤버는 표시 안 함 */}
        {!isMember && (
          <>
            <div className="bg-[#296973]/10 rounded-xl p-5 mb-6 text-sm">
              <p className="font-bold text-[#296973] mb-3">참가비 납부 계좌</p>
              <div className="space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span className="text-gray-400">은행</span>
                  <span className="font-semibold">하나은행</span>
                </div>
                <div className="flex justify-between items-center text-gray-700">
                  <span className="text-gray-400">계좌번호</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#296973] tracking-wide">5539-10-13844507</span>
                    <button
                      type="button"
                      onClick={copyAccount}
                      className="text-xs px-2 py-0.5 rounded-md bg-[#296973]/15 text-[#296973] hover:bg-[#296973]/25 transition-colors"
                    >
                      {copied ? "복사됨 ✓" : "복사"}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span className="text-gray-400">예금주</span>
                  <span className="font-semibold">코이노니아</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span className="text-gray-400">입금자명</span>
                  <span className="font-semibold text-[#ff6b35]">{form.name}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">
              입금자명을 <span className="font-medium">{form.name}</span>으로 해주세요.
            </p>
          </>
        )}

        <div className="mt-6 pt-5 border-t border-gray-100 text-center">
          <a
            href="/booking-check"
            className="text-sm text-[#296973] hover:underline"
          >
            나중에 예약 내역 다시 확인하기 →
          </a>
        </div>
      </div>
    );
  }

  /* ─────────── Step 2: 개인정보 ─────────── */
  if (step === "info") {
    return (
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <button
          type="button"
          onClick={() => { setStep("select"); setError(""); }}
          className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 transition-colors"
        >
          ← 프로그램 다시 선택
        </button>

        <h3 className="text-lg font-bold text-[#372a14] mb-1">참가 정보 입력</h3>
        <p className="text-sm text-[#296973] font-medium mb-6">
          {program?.dateLabel} · {program?.title}
        </p>

        {/* 상시 프로그램 — 방문 날짜 선택 */}
        {program?.pickDate && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#372a14] mb-1">
              방문 날짜 <span className="text-red-400">*</span>
            </label>
            {mode === "calendar" ? (
              <p className="text-sm text-[#296973] font-semibold">{visitDayLabel}</p>
            ) : (
              <select
                value={visitDate}
                onChange={(e) => { setVisitDate(e.target.value); setSlot(""); setError(""); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                required
              >
                <option value="">날짜를 선택하세요</option>
                {visitDayOptions.map((d) => (
                  <option key={d} value={d}>{festivalDayLabel(d)}</option>
                ))}
              </select>
            )}
            {!program.slots && (
              <p className="text-xs text-gray-400 mt-1.5">
                {openTimeLabel} 사이에 편한 시간으로 방문해 주세요.
              </p>
            )}

            {/* 30분 단위 시간대 — 칸마다 정원이 따로 찬다 */}
            {program.slots && visitDate && (
              <div className="mt-5">
                <label className="block text-sm font-medium text-[#372a14] mb-2">
                  시간대 <span className="text-red-400">*</span>
                  <span className="text-gray-400 font-normal ml-1">
                    ({program.slots.minutes}분 · {program.capacity}명)
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {slotList.map((sl) => {
                    const left = remainingFor(program, `${visitDayLabel} ${sl.label}`);
                    const full = left === 0;
                    const picked = slot === sl.label;
                    return (
                      <button
                        key={sl.value}
                        type="button"
                        disabled={full}
                        onClick={() => { setSlot(sl.label); setError(""); }}
                        className={`rounded-xl border-2 px-2 py-2.5 text-center transition-colors ${
                          full
                            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                            : picked
                              ? "border-[#ff6b35] bg-[#ff6b35]/5 text-[#372a14]"
                              : "border-gray-100 bg-gray-50/50 text-[#372a14] hover:border-gray-200"
                        }`}
                      >
                        <span className="block text-xs font-semibold">{sl.label}</span>
                        {full && <span className="block text-[10px] mt-0.5">마감</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-[#372a14] mb-1">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="홍길동"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#372a14] mb-1">
              연락처 <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-0000-0000"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#372a14] mb-1">
              이메일 <span className="text-gray-400 font-normal">(선택 — 확인 메일 발송)</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="hello@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#372a14] mb-1">할인 적용</label>
            <select
              value={discount}
              onChange={(e) => setDiscount(e.target.value as "none" | "geot")}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
            >
              <option value="none">해당 없음</option>
              <option value="geot">멤버십 &#39;곁&#39; — 무료 참가</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#372a14] mb-1">
              요청사항 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              rows={2}
              placeholder="알레르기, 특이사항 등"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35] resize-none transition-colors"
            />
          </div>
        </div>

        {bookingDate && (
          <div className="bg-[#296973]/8 rounded-xl px-4 py-3 mb-5 text-sm">
            <span className="text-[#296973] font-medium">{bookingDate}</span>
          </div>
        )}

        {/* 금액 요약 */}
        <div className="bg-[#fffbde] rounded-xl p-4 mb-5 text-sm">
          <div className="flex justify-between text-gray-500 mb-1">
            <span>{program?.title}</span>
            <span>{program?.price.toLocaleString()}원</span>
          </div>
          {isMember && (
            <div className="flex justify-between text-[#296973] mb-1">
              <span>멤버십 &#39;곁&#39; — 무료 참가</span>
              <span>−{discountAmount.toLocaleString()}원</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-2 border-t border-yellow-200 mt-1">
            <span>최종 참가비</span>
            <span className="text-[#ff6b35]">{totalAmount === 0 ? "무료" : `${totalAmount.toLocaleString()}원`}</span>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff6b35] text-white font-semibold py-4 rounded-xl hover:bg-[#e55a25] transition-colors disabled:opacity-60"
        >
          {loading ? "처리 중..." : "신청 완료 → 계좌 정보 확인"}
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          신청 후 계좌이체로 참가비를 납부하면 확정됩니다.
        </p>
      </form>
    );
  }

  /* ─────────── Step 1: 프로그램 선택 ─────────── */
  const isDisabledProgram = (p: Program) => {
    const remaining = getRemaining(p);
    return (remaining !== null && remaining === 0) || isPastProgram(p);
  };

  const available = programs.filter((p) => !isDisabledProgram(p));
  const closed = programs.filter((p) => isDisabledProgram(p));

  const priceColor = (type: ProgramType) =>
    groups.find((g) => g.type === type)?.priceClass ?? "text-[#372a14]";

  const renderCard = (p: Program) => {
    const isDisabled = isDisabledProgram(p);
    return (
      <label
        key={p.id}
        className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${
          isDisabled ? "border-gray-100 bg-gray-50/50 opacity-60 cursor-not-allowed"
          : selectedId === p.id ? "border-[#ff6b35] bg-[#ff6b35]/5 cursor-pointer"
          : "border-gray-100 hover:border-gray-200 bg-gray-50/50 cursor-pointer"
        }`}
      >
        <input type="radio" name="program" value={p.id}
          checked={selectedId === p.id} disabled={isDisabled}
          onChange={() => {
            setSelectedId(p.id);
            setVisitDate(mode === "calendar" && p.pickDate ? calendarDay : "");
            setSlot("");
            setError("");
          }}
          className="accent-[#ff6b35] mt-1 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-[#372a14] text-sm">{p.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {isDisabled && (
                <span className="text-xs font-semibold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">마감</span>
              )}
              <span className={`text-xs font-semibold ${priceColor(p.type)}`}>{p.price === 0 ? "무료" : `${p.price.toLocaleString()}원`}</span>
            </div>
          </div>
          {p.dates ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {p.dates.map((d) => (
                <span key={d} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{d}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">{p.dateLabel}</p>
          )}
          {p.subtitle && <p className="text-xs text-gray-400 mt-1">{p.subtitle}</p>}
          {p.note && <p className="text-xs text-gray-400/80 mt-1">{p.note}</p>}
        </div>
      </label>
    );
  };

  if (mode === "calendar") {
    const weeks = festivalCalendar();
    const openCount = (iso: string) =>
      programsOnDay(programs, iso).filter((p) => !isDisabledProgram(p)).length;
    const dayPrograms = calendarDay ? programsOnDay(programs, calendarDay) : [];

    return (
      <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm scroll-mt-20">
        <h3 className="text-lg font-bold text-[#372a14] mb-1">{heading}</h3>
        <p className="text-sm text-gray-400 mb-6">{description}</p>

        {/* ── 달력 ── */}
        <div className="mb-7">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => (
              <div
                key={d}
                className={`text-center text-[11px] py-1 ${
                  i === 6 ? "text-red-400" : i === 5 ? "text-blue-400" : "text-gray-400"
                }`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((d, di) => {
                  if (!d) return <div key={`empty-${wi}-${di}`} />;
                  const count = openCount(d.iso);
                  const disabled = d.closed || d.iso < today || count === 0;
                  const picked = calendarDay === d.iso;
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setCalendarDay(d.iso);
                        setSelectedId("");
                        setSlot("");
                        setError("");
                      }}
                      className={`rounded-xl py-2 transition-colors border-2 ${
                        picked
                          ? "border-[#ff6b35] bg-[#ff6b35]/5"
                          : disabled
                            ? "border-transparent bg-gray-50 cursor-not-allowed"
                            : "border-transparent bg-gray-50/70 hover:bg-[#ff6b35]/5"
                      }`}
                    >
                      <span
                        className={`block text-sm font-semibold ${
                          disabled
                            ? "text-gray-300"
                            : d.weekday === 0
                              ? "text-red-500"
                              : d.weekday === 6
                                ? "text-blue-500"
                                : "text-[#372a14]"
                        }`}
                      >
                        {d.day}
                      </span>
                      <span className="block text-[10px] mt-0.5 text-gray-400">
                        {d.closed ? "휴무" : count > 0 ? `${count}개` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── 고른 날의 프로그램 ── */}
        {!calendarDay ? (
          <p className="text-sm text-gray-400 text-center py-8 bg-gray-50/70 rounded-xl">
            날짜를 먼저 선택해 주세요.
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-[#296973] mb-3">
              {festivalDayLabel(calendarDay)}
              <span className="text-gray-400 font-normal ml-2">
                프로그램 {dayPrograms.length}개
              </span>
            </p>
            <div className="space-y-2 mb-6">{dayPrograms.map(renderCard)}</div>
          </>
        )}

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          onClick={handleNext}
          className="w-full bg-[#372a14] text-white font-semibold py-4 rounded-xl hover:bg-[#ff6b35] transition-colors"
        >
          다음 단계 — 참가 정보 입력
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm scroll-mt-20">
      <h3 className="text-lg font-bold text-[#372a14] mb-1">{heading}</h3>
      <p className="text-sm text-gray-400 mb-7">{description}</p>

      {/* 참여 가능한 프로그램 — 그룹별 구분 */}
      {groups.map((g) => {
        const inGroup = available.filter((p) => p.type === g.type);
        if (inGroup.length === 0) return null;
        return (
          <div key={g.type} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold tracking-widest uppercase ${g.labelClass}`}>{g.label}</span>
            </div>
            <div className="space-y-2">
              {inGroup.map(renderCard)}
            </div>
          </div>
        );
      })}

      {/* 지난 프로그램 */}
      {closed.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium shrink-0">지난 프로그램</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="space-y-2 mb-7">
            {closed.map(renderCard)}
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        onClick={handleNext}
        className="w-full bg-[#372a14] text-white font-semibold py-4 rounded-xl hover:bg-[#ff6b35] transition-colors"
      >
        다음 단계 — 참가 정보 입력
      </button>
    </div>
  );
}
