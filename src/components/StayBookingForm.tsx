"use client";

import { useState, useEffect, useCallback } from "react";

type DateRange = { start: string; end: string };

function isOverlapping(checkIn: string, checkOut: string, ranges: DateRange[]): boolean {
  const ci = new Date(checkIn);
  const co = new Date(checkOut);
  return ranges.some(({ start, end }) => {
    const s = new Date(start);
    const e = new Date(end);
    return ci <= e && co > s;
  });
}

const rooms = [
  { id: "nagnae", name: "나그네방", price: 60000, desc: "혼자 떠나온 여행자를 위한 아늑한 방", capacity: "1인" },
  { id: "oksun",  name: "옥순방",   price: 120000, desc: "둘이 함께 머물기 좋은 편안한 방",      capacity: "1~2인" },
  { id: "yeutae", name: "여태방",   price: 160000, desc: "넉넉한 공간에서 여유롭게 머무는 방",    capacity: "2~3인" },
];

type Step = "form" | "done";

export default function StayBookingForm() {
  const [step, setStep] = useState<Step>("form");
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    checkIn: "", checkOut: "",
    count: "1", discount: "none",
    cashReceipt: "", memo: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<Record<string, DateRange[]>>({});
  const [dateConflict, setDateConflict] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAccount = useCallback(() => {
    navigator.clipboard.writeText("5539-10-13844507");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => r.json())
      .then(setAvailability)
      .catch(() => {});
  }, []);

  const blockedRanges = availability[selected] ?? [];
  const room = rooms.find((r) => r.id === selected);

  const nights =
    form.checkIn && form.checkOut
      ? Math.max(0, Math.floor((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000))
      : 0;

  const discountRate = form.discount === "geot" ? 0.2 : form.discount === "nagnae" ? 0.3 : 0;
  const baseAmount = room ? room.price * nights : 0;
  const discountAmount = Math.round(baseAmount * discountRate);
  const totalAmount = baseAmount - discountAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { setError("방을 선택해주세요."); return; }
    if (!form.name || !form.phone || !form.checkIn || !form.checkOut) {
      setError("필수 항목을 모두 입력해주세요."); return;
    }
    if (nights <= 0) { setError("체크아웃 날짜를 확인해주세요."); return; }
    if (isOverlapping(form.checkIn, form.checkOut, blockedRanges)) {
      setError("선택하신 날짜에 이미 예약이 있습니다. 다른 날짜를 선택해주세요."); return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "stay",
          room: room?.name,
          nights,
          name: form.name,
          phone: form.phone,
          email: form.email,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          discount: form.discount,
          totalAmount,
          memo: [form.memo, form.cashReceipt ? `현금영수증: ${form.cashReceipt}` : ""].filter(Boolean).join(" / "),
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

  /* ── 완료 화면 ── */
  if (step === "done") {
    const isMember = form.discount === "geot";
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🏠</div>
          <h3 className="text-xl font-bold text-[#372a14] mb-2">예약 확정!</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            코이노니아에서 기다리고 있을게요.
          </p>
        </div>

        <div className="bg-[#296973]/10 border border-[#296973]/20 rounded-xl px-5 py-4 mb-6">
          <p className="text-sm font-semibold text-[#296973] mb-1">
            {isMember ? "멤버십 '곁' — 20% 할인 적용" : "신청 즉시 예약이 확정됩니다"}
          </p>
          <p className="text-sm text-[#296973]/80 leading-relaxed">
            {isMember
              ? "아래 계좌로 할인 금액을 입금해주세요."
              : "코이노니아 스테이는 별도 안내 메시지를 드리지 않습니다.\n약속한 날에 편히 방문해 주세요."}
          </p>
        </div>

        <div className="bg-[#fffbde] rounded-xl p-5 mb-5 text-sm">
          <p className="font-bold text-[#372a14] mb-3">예약 내역</p>
          <div className="space-y-2 text-gray-600">
            <div className="flex justify-between">
              <span className="text-gray-400">객실</span>
              <span className="font-medium text-[#372a14]">{room?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">체크인</span>
              <span className="font-medium text-[#372a14]">{form.checkIn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">체크아웃</span>
              <span className="font-medium text-[#372a14]">{form.checkOut} ({nights}박)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">신청자</span>
              <span className="font-medium text-[#372a14]">{form.name}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[#296973]">
                <span>할인 ({form.discount === "geot" ? "20%" : "30%"})</span>
                <span>−{discountAmount.toLocaleString()}원</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-[#ff6b35] text-base pt-2 border-t border-yellow-200 mt-1">
              <span>최종 입금액</span>
              <span>{totalAmount.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        <div className="bg-[#296973]/10 rounded-xl p-5 mb-6 text-sm">
          <p className="font-bold text-[#296973] mb-3">숙박비 납부 계좌</p>
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
          문의: <a href="https://instagram.com/koinonia_andong" target="_blank" rel="noopener noreferrer" className="text-[#ff6b35]">@koinonia_andong</a>
        </p>

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

  /* ── 예약 폼 ── */
  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
      <h3 className="text-xl font-bold text-[#372a14] mb-6">스테이 예약</h3>

      {/* 객실 선택 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#372a14] mb-3">
          객실 선택 <span className="text-red-400">*</span>
        </label>
        <div className="space-y-3">
          {rooms.map((r) => (
            <label
              key={r.id}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                selected === r.id ? "border-[#ff6b35] bg-[#ff6b35]/5" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="room"
                value={r.id}
                checked={selected === r.id}
                onChange={() => {
                  setSelected(r.id);
                  if (form.checkIn && form.checkOut) {
                    setDateConflict(isOverlapping(form.checkIn, form.checkOut, availability[r.id] ?? []));
                  }
                }}
                className="accent-[#ff6b35]"
              />
              <div className="flex-1">
                <div className="flex justify-between">
                  <div>
                    <span className="font-semibold text-[#372a14]">{r.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{r.capacity}</span>
                  </div>
                  <span className="text-[#ff6b35] font-bold">{r.price.toLocaleString()}원/박</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{r.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 날짜 */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <label className="block text-sm font-medium text-[#372a14] mb-1">체크인 <span className="text-red-400">*</span></label>
          <input
            type="date"
            value={form.checkIn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              const newForm = { ...form, checkIn: e.target.value };
              setForm(newForm);
              if (newForm.checkIn && newForm.checkOut)
                setDateConflict(isOverlapping(newForm.checkIn, newForm.checkOut, blockedRanges));
            }}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#372a14] mb-1">체크아웃 <span className="text-red-400">*</span></label>
          <input
            type="date"
            value={form.checkOut}
            min={form.checkIn || new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              const newForm = { ...form, checkOut: e.target.value };
              setForm(newForm);
              if (newForm.checkIn && newForm.checkOut)
                setDateConflict(isOverlapping(newForm.checkIn, newForm.checkOut, blockedRanges));
            }}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
            required
          />
        </div>
      </div>

      {dateConflict && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3 text-sm text-red-700">
          ⚠️ 선택하신 날짜에 이미 예약이 있습니다. 다른 날짜를 선택해주세요.
        </div>
      )}
      {nights > 0 && !dateConflict && (
        <p className="text-sm text-[#296973] font-medium mb-4">✓ {nights}박 선택됨</p>
      )}

      {/* 인원 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[#372a14] mb-1">투숙 인원</label>
        <select
          value={form.count}
          onChange={(e) => setForm({ ...form, count: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
        >
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}명</option>)}
        </select>
      </div>

      {/* 이름 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[#372a14] mb-1">이름 <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="홍길동"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
          required
        />
      </div>

      {/* 연락처 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[#372a14] mb-1">연락처 <span className="text-red-400">*</span></label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="010-0000-0000"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
          required
        />
      </div>

      {/* 이메일 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[#372a14] mb-1">
          이메일 <span className="text-gray-400 font-normal text-xs">(선택 — 확인 메일 발송)</span>
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="hello@example.com"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
        />
      </div>

      {/* 할인 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[#372a14] mb-1">할인 적용</label>
        <select
          value={form.discount}
          onChange={(e) => setForm({ ...form, discount: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
        >
          <option value="none">해당 없음</option>
          <option value="geot">멤버십 &apos;곁&apos; (20% 할인)</option>
          <option value="nagnae">서울 나그네방 후원자 (30% 할인)</option>
        </select>
      </div>

      {/* 현금영수증 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-[#372a14] mb-1">
          현금영수증 번호 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        <input
          type="text"
          value={form.cashReceipt}
          onChange={(e) => setForm({ ...form, cashReceipt: e.target.value })}
          placeholder="010-0000-0000 또는 사업자번호"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
        />
        <p className="text-xs text-gray-400 mt-1">번호를 남겨주시면 입금 확인 후 발행해드립니다.</p>
      </div>

      {/* 요청사항 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#372a14] mb-1">
          요청사항 <span className="text-gray-400 font-normal">(선택)</span>
        </label>
        <textarea
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
          rows={3}
          placeholder="특별 요청사항이나 문의사항을 적어주세요."
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35] resize-none"
        />
      </div>

      {/* 금액 요약 */}
      {room && nights > 0 && (
        <div className="bg-[#fffbde] rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">{room.name} × {nights}박</span>
            <span>{baseAmount.toLocaleString()}원</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm mb-1 text-[#ff6b35]">
              <span>할인 ({form.discount === "geot" ? "20%" : "30%"})</span>
              <span>−{discountAmount.toLocaleString()}원</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-yellow-200 pt-2 mt-2">
            <span>총 입금액</span>
            <span className="text-[#ff6b35]">{totalAmount.toLocaleString()}원</span>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <button
        type="submit"
        disabled={loading || !selected || nights <= 0 || dateConflict}
        className="w-full bg-[#ff6b35] text-white font-semibold py-4 rounded-xl hover:bg-[#e55a25] transition-colors disabled:opacity-50"
      >
        {loading ? "처리 중..." : "예약 신청 완료 → 계좌 정보 확인"}
      </button>
      <p className="text-xs text-gray-400 text-center mt-3">
        신청 후 계좌이체로 입금하시면 예약이 확정됩니다.
      </p>
    </form>
  );
}
