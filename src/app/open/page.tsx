"use client";

import { useState } from "react";

const CONTRIBUTION_OPTIONS = [
  { id: "salon-join", label: "살롱에 참여하겠다", desc: "코이노니아의 소셜 살롱 프로그램에 참여해요" },
  { id: "salon-lead", label: "살롱을 직접 이끌고 싶다", desc: "내가 가진 것으로 살롱을 기획하고 이끌어요" },
  { id: "heritage-tour", label: "헤리티지 투어에 참여하겠다", desc: "안동의 숨겨진 공간을 함께 걷는 투어예요" },
];

const MIN_DATE = "2026-07-19";
const MAX_DATE = "2026-08-31";

export default function OpenStayPage() {
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    checkIn: "", checkOut: "",
    groupType: "", groupSize: "",
    reason: "", contribution: [] as string[], message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const toggleContribution = (id: string) => {
    setForm((prev) => ({
      ...prev,
      contribution: prev.contribution.includes(id)
        ? prev.contribution.filter((c) => c !== id)
        : [...prev.contribution, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.checkIn || !form.checkOut) {
      setError("이름, 연락처, 날짜는 필수예요.");
      return;
    }
    if (!form.groupType) {
      setError("누구랑 오시는지 선택해주세요.");
      return;
    }
    if (form.contribution.length === 0) {
      setError("기여 방법을 하나 이상 선택해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/open-stay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setDone(true);
      } else {
        setError(json.message ?? "오류가 발생했어요. 다시 시도해주세요.");
      }
    } catch {
      setError("서버 연결 오류. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-[#faf9f7] min-h-screen">

      {/* ── 히어로 ── */}
      <section className="bg-[#372a14] px-6 md:px-16 py-24 md:py-32">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-6 font-medium">
            Koinonia Stay · 2026 여름
          </p>
          <h1 className="text-4xl md:text-6xl font-light text-white leading-tight mb-6">
            영업정지,<br />
            그래도 문은<br />
            열어요.
          </h1>
          <p className="text-white/60 text-base md:text-lg leading-relaxed max-w-xl">
            코이노니아 스테이가 행정 절차로 잠시 멈췄습니다.<br />
            하지만 공간은 그대로고, 사람을 만나고 싶은 마음도 그대로예요.<br />
            <strong className="text-white/90">7월 19일부터 8월 31일까지, 무료로 문을 열겠습니다.</strong>
          </p>
        </div>
      </section>

      {/* ── 우리가 바라는 것 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            돈 말고
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-4">
            이걸로 대신해주세요
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-12 max-w-xl">
            안 그래도 힘든 시간입니다. 그래도 뭐라도 해주세요.<br />
            돈은 받을 수 없지만, 당신이 가진 것으로 함께해주시면 돼요.
          </p>

          <div className="space-y-4">
            {[
              {
                num: "01",
                title: "재능이 있다면, 나눠주세요",
                desc: "노래를 잘 한다면 오픈마이크에 나와주고, 이야기할 거리가 있다면 살롱을 이끌어주세요. 당신이 살롱에 참여하는 것만으로도 충분해요.",
                color: "#ff6b35",
              },
              {
                num: "02",
                title: "헤리티지 투어에 함께해주세요",
                desc: "안동의 숨겨진 공간들을 함께 걷는 투어예요. 외국인 여행자와 함께 걸으며 안동을 새롭게 발견하는 시간이 될 거예요.",
                color: "#296973",
              },
            ].map((item) => (
              <div key={item.num} className="flex gap-6 p-7 bg-[#faf9f7] rounded-2xl">
                <span className="text-2xl font-bold shrink-0" style={{ color: item.color }}>{item.num}</span>
                <div>
                  <h3 className="text-base font-semibold text-[#372a14] mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 누가 올 수 있나요 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            Who · 누가 올 수 있나요?
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-4">
            혼자도, 함께도 괜찮아요
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-xl">
            혼자 조용히 쉬러 와도 좋고, 여럿이 함께 와도 좋아요.<br />
            신청서를 확인한 뒤 호스트가 직접 연락드립니다.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { emoji: "🧍", label: "혼자", desc: "혼자 조용히 쉬러 와도 돼요" },
              { emoji: "👫", label: "둘이", desc: "친구든, 커플이든" },
              { emoji: "👨‍👩‍👧", label: "가족", desc: "아이와 함께해도 좋아요" },
              { emoji: "🫂", label: "팀", desc: "동료들과 워크숍도 가능해요" },
            ].map((g) => (
              <div key={g.label} className="bg-white rounded-2xl p-5 text-center border border-gray-100">
                <div className="text-3xl mb-3">{g.emoji}</div>
                <p className="text-sm font-semibold text-[#372a14] mb-1">{g.label}</p>
                <p className="text-xs text-gray-400 leading-snug">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 신청 폼 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-white">
        <div className="max-w-2xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            Apply · 무료 개방 신청
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-2">
            함께해주실 건가요?
          </h2>

          {done ? (
            <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm text-center">
              <div className="text-5xl mb-4">🙏</div>
              <h3 className="text-xl font-semibold text-[#372a14] mb-3">신청해주셔서 감사해요</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {form.name}님의 신청을 잘 받았어요.<br />
                일정을 확인한 뒤 호스트가 직접 연락드릴게요.<br />
                응원해주셔서 힘이 납니다.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">

              {/* 이름 + 연락처 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">
                    이름 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="홍길동"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">
                    연락처 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                  />
                </div>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-xs font-medium text-[#372a14] mb-1">
                  이메일 <span className="text-gray-400 font-normal">(확정 안내를 받으실 이메일)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="hello@example.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                />
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">
                    체크인 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.checkIn}
                    min={MIN_DATE}
                    max={MAX_DATE}
                    onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">
                    체크아웃 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.checkOut}
                    min={form.checkIn || MIN_DATE}
                    max={MAX_DATE}
                    onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors bg-white"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-3">7월 19일 – 8월 31일 사이에서 선택해주세요.</p>

              {/* 누구랑 오시나요 */}
              <div>
                <label className="block text-xs font-medium text-[#372a14] mb-3">
                  누구랑 오시나요? <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "solo", emoji: "🧍", label: "혼자" },
                    { id: "duo", emoji: "👫", label: "둘이" },
                    { id: "family", emoji: "👨‍👩‍👧", label: "가족" },
                    { id: "team", emoji: "🫂", label: "팀/모임" },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setForm({ ...form, groupType: g.id })}
                      className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 transition-all text-center ${
                        form.groupType === g.id
                          ? "border-[#ff6b35] bg-[#ff6b35]/5"
                          : "border-gray-100 bg-[#faf9f7] hover:border-gray-300"
                      }`}
                    >
                      <span className="text-2xl">{g.emoji}</span>
                      <span className="text-xs font-medium text-[#372a14]">{g.label}</span>
                    </button>
                  ))}
                </div>
                {form.groupType && form.groupType !== "solo" && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-[#372a14] mb-1">
                      총 몇 명인가요?
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={form.groupSize}
                      onChange={(e) => setForm({ ...form, groupSize: e.target.value })}
                      placeholder="예: 4"
                      className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* 방문 이유 */}
              <div>
                <label className="block text-xs font-medium text-[#372a14] mb-1">방문 이유</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="어떤 이유로 코이노니아를 찾아오시나요?"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors resize-none"
                />
              </div>

              {/* 기여 방법 */}
              <div>
                <label className="block text-xs font-medium text-[#372a14] mb-3">
                  기여 방법 <span className="text-red-400">*</span>
                  <span className="text-gray-400 font-normal ml-1">(복수 선택 가능)</span>
                </label>
                <div className="space-y-2.5">
                  {CONTRIBUTION_OPTIONS.map((opt) => {
                    const selected = form.contribution.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleContribution(opt.id)}
                        className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? "border-[#ff6b35] bg-[#ff6b35]/5"
                            : "border-gray-100 bg-[#faf9f7] hover:border-gray-300"
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? "border-[#ff6b35] bg-[#ff6b35]" : "border-gray-300"
                        }`}>
                          {selected && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#372a14]">{opt.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 응원 메시지 */}
              <div>
                <label className="block text-xs font-medium text-[#372a14] mb-1">
                  응원 메시지 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="힘든 시간을 보내고 있는 코이노니아에게 한 마디 건네주세요."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors resize-none"
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#372a14] text-white font-semibold rounded-xl hover:bg-[#ff6b35] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {loading ? "신청 중..." : "신청하기"}
              </button>

              <p className="text-xs text-gray-400 text-center leading-relaxed">
                신청 후 호스트가 일정을 확인해 직접 확정 연락을 드립니다.<br />
                문의: <a href="https://instagram.com/koinonia_andong" className="text-[#ff6b35]">@koinonia_andong</a>
              </p>
            </form>
          )}
        </div>
      </section>

    </main>
  );
}
