"use client";

import { useState } from "react";
import Link from "next/link";

type Booking = {
  type: "살롱" | "스테이";
  createdAt: string;
  name: string;
  program: string;
  date: string;
  amount: string;
  status: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    신청:     { label: "신청 완료", cls: "bg-blue-50 text-blue-600" },
    입금확인: { label: "입금 확인됨", cls: "bg-green-50 text-green-700" },
    확정:     { label: "확정", cls: "bg-green-50 text-green-700" },
    취소:     { label: "취소됨", cls: "bg-gray-100 text-gray-400" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function BookingCheckPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/booking-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "조회 중 오류가 발생했습니다.");
        return;
      }
      setBookings(data.bookings);
      setSearched(true);
    } catch {
      setError("서버 연결 오류. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf9f7] py-16 px-4">
      <div className="max-w-lg mx-auto">

        {/* 헤더 */}
        <div className="text-center mb-10">
          <Link href="/" className="text-xs text-gray-400 tracking-widest uppercase mb-6 block">
            ← 코이노니아
          </Link>
          <h1 className="text-2xl font-light text-[#372a14] mb-2">예약 확인</h1>
          <p className="text-gray-400 text-sm">신청 시 입력한 전화번호로 예약 내역을 확인할 수 있어요.</p>
        </div>

        {/* 조회 폼 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <label className="block text-sm font-medium text-[#372a14] mb-2">전화번호</label>
          <div className="flex gap-3">
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSearched(false); }}
              placeholder="010-0000-0000"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff6b35]"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#ff6b35] text-white font-semibold px-5 py-3 rounded-xl hover:bg-[#e55a25] transition-colors disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {loading ? "조회 중…" : "조회하기"}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </form>

        {/* 결과 */}
        {searched && (
          <>
            {bookings.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                <p className="text-4xl mb-4">🔍</p>
                <p className="text-[#372a14] font-medium mb-1">신청 내역이 없어요</p>
                <p className="text-gray-400 text-sm">
                  전화번호를 다시 확인해주세요.<br />
                  신청이 아직 처리 중일 수도 있어요.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400 px-1">
                  {bookings[0].name}님의 신청 내역 {bookings.length}건
                </p>
                {bookings.map((b, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{b.type === "살롱" ? "🎉" : "🏠"}</span>
                        <span className="font-semibold text-[#372a14]">
                          {b.type === "살롱" ? "살롱" : "스테이"}
                        </span>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">
                          {b.type === "살롱" ? "프로그램" : "객실"}
                        </span>
                        <span className="font-medium text-[#372a14]">{b.program || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">
                          {b.type === "살롱" ? "일시" : "기간"}
                        </span>
                        <span className="font-medium text-[#372a14]">{b.date || "—"}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-100 pt-2 mt-1">
                        <span className="text-gray-400">납부금액</span>
                        <span className="font-bold text-[#ff6b35]">
                          {Number(b.amount) === 0 ? "무료" : `${Number(b.amount).toLocaleString()}원`}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-300 mt-3 text-right">
                      신청일: {b.createdAt.slice(0, 10)}
                    </p>
                  </div>
                ))}

                <p className="text-xs text-gray-400 text-center pt-2">
                  문의가 있으시면{" "}
                  <a
                    href="https://instagram.com/koinonia_andong"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff6b35]"
                  >
                    @koinonia_andong
                  </a>
                  으로 연락주세요.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
