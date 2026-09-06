"use client";

import { useState, useCallback, useEffect } from "react";

type ProgramType = "potluck" | "friday" | "special";

type Program = {
  id: string;
  type: ProgramType;
  date: string;
  dateLabel: string;
  dates?: string[]; // 여러 날짜 칩으로 표시할 때
  title: string;
  subtitle?: string;
  price: number;
  capacity?: number; // 정원 제한 (없으면 무제한)
};

const PROGRAMS: Program[] = [
  // 수요 포틀럭
  {
    id: "p0902",
    type: "potluck",
    date: "2026-09-02",
    dateLabel: "9월 2일 (수) 19:00",
    title: "9월 생일자 파티 🎂",
    subtitle: "이달의 작가 '톨스토이' — 9월생들과 함께 먹고 축하하는 저녁",
    price: 10000,
  },
  {
    id: "p0916",
    type: "potluck",
    date: "2026-09-16",
    dateLabel: "9월 16일 (수) 19:00",
    title: "제철 과일 클럽 🍇",
    subtitle: "다품종 포도와 햇밀 빵으로 차리는 즉흥 과일 한 상",
    price: 20000,
  },
  {
    id: "p0923",
    type: "potluck",
    date: "2026-09-23",
    dateLabel: "9월 23일 (수) 19:00",
    title: "추석포틀럭: 명절오락관 🌕",
    subtitle: "명절 음식 한 상에 윷놀이까지 — 코이노니아식 추석 전야제",
    price: 10000,
  },
  {
    id: "p0930",
    type: "potluck",
    date: "2026-09-30",
    dateLabel: "9월 30일 (수) 19:00",
    title: "탈춤포틀럭 💃",
    subtitle: "축제 한복판에서 맞는 수요일, 먹고 마시고 탈춤판까지",
    price: 10000,
  },
  // 프라이데이나잇
  {
    id: "f0904",
    type: "friday",
    date: "2026-09-04",
    dateLabel: "9월 4일 (금) 20:00",
    title: "무비나잇 🎬",
    subtitle: "술 한잔과 함께 영화 한 편 보고 실컷 이야기합니다",
    price: 20000,
  },
  {
    id: "f0911",
    type: "friday",
    date: "2026-09-11",
    dateLabel: "9월 11일 (금) 20:00",
    title: "개강파티 🎒",
    subtitle: "새 학기의 피로를 핑계 삼아 같이 한잔하는 밤",
    price: 20000,
  },
  {
    id: "f0918",
    type: "friday",
    date: "2026-09-18",
    dateLabel: "9월 18일 (금) 20:00",
    title: "보드게임나잇 🎲",
    subtitle: "처음 본 사람과도 한 판 붙어보는 게임의 밤",
    price: 20000,
  },
  // Someday Salons
  {
    id: "s0912",
    type: "special",
    date: "2026-09-12",
    dateLabel: "9월 12일 (토) 20:00",
    title: "드렁큰 낭독회 📖",
    subtitle: "술 한 잔 곁에 두고 각자 좋아하는 문장을 소리 내어 읽는 밤",
    price: 10000,
  },
  {
    id: "s0915",
    type: "special",
    date: "2026-09-15",
    dateLabel: "9월 15일 · 22일 · 29일 (월) 20:00",
    dates: ["9월 15일 (월)", "9월 22일 (월)", "9월 29일 (월)"],
    title: "아이, 마이, 미, 마인 🎭",
    subtitle: "신청 시 5회차 전체 참가 / 세부 내용은 8/31(월) 저녁 공개 예정 / 문화놀이터 사업 (무료)",
    price: 0,
  },
];

type Step = "select" | "info" | "done";

export default function SalonBookingForm() {
  const [step, setStep] = useState<Step>("select");
  const [selectedId, setSelectedId] = useState<string>("");
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

  const getRemaining = (p: Program) => {
    if (!p.capacity) return null;
    const booked = counts[p.title] ?? 0;
    return Math.max(0, p.capacity - booked);
  };

  const isPastProgram = (p: Program) => {
    const today = new Date().toISOString().slice(0, 10);
    return p.date < today;
  };

  const program = PROGRAMS.find((p) => p.id === selectedId);
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
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "salon",
          program: program?.title,
          date: program?.dateLabel,
          totalAmount,
          discount,
          ...form,
        }),
      });
      if (res.ok) {
        setStep("done");
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
              <span className="font-medium text-[#372a14]">{program?.dateLabel}</span>
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

  const available = PROGRAMS.filter((p) => !isDisabledProgram(p));
  const closed = PROGRAMS.filter((p) => isDisabledProgram(p));

  const priceColor = (type: ProgramType) =>
    type === "potluck" ? "text-[#296973]" : type === "friday" ? "text-[#ff6b35]" : "text-[#372a14]";

  const renderCard = (p: Program) => {
    const remaining = getRemaining(p);
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
          onChange={() => { setSelectedId(p.id); setError(""); }}
          className="accent-[#ff6b35] mt-1 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-[#372a14] text-sm">{p.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {isDisabled
                ? <span className="text-xs font-semibold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">마감</span>
                : remaining !== null && remaining <= 3
                  ? <span className="text-xs font-semibold bg-red-50 text-red-500 px-2 py-0.5 rounded-full">잔여 {remaining}석</span>
                  : remaining !== null
                    ? <span className="text-xs font-semibold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">잔여 {remaining}석</span>
                    : null}
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
        </div>
      </label>
    );
  };

  return (
    <div id="booking" className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm scroll-mt-20">
      <h3 className="text-lg font-bold text-[#372a14] mb-1">프로그램 신청</h3>
      <p className="text-sm text-gray-400 mb-7">참가할 프로그램과 날짜를 선택하세요.</p>

      {/* 참여 가능한 프로그램 — 타입별 구분 */}
      {(["potluck", "friday", "special"] as ProgramType[]).map((type) => {
        const group = available.filter((p) => p.type === type);
        if (group.length === 0) return null;
        const sublabel =
          type === "potluck" ? "Wednesday Potluck" :
          type === "friday"  ? "Friday Night" :
                               "Someday Salons";
        const labelColor =
          type === "potluck" ? "text-[#296973]" :
          type === "friday"  ? "text-[#ff6b35]" :
                               "text-[#372a14]";
        return (
          <div key={type} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold tracking-widest uppercase ${labelColor}`}>{sublabel}</span>
            </div>
            <div className="space-y-2">
              {group.map(renderCard)}
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
