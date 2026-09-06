"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");
    const bookingRaw = searchParams.get("bookingData");

    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      setMessage("결제 정보가 올바르지 않습니다.");
      return;
    }

    let bookingData = {};
    try {
      bookingData = bookingRaw ? JSON.parse(decodeURIComponent(bookingRaw)) : {};
    } catch {
      bookingData = {};
    }

    fetch("/api/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), bookingData }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(data.message ?? "결제 확인 중 오류가 발생했습니다.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("서버 연결 오류");
      });
  }, [searchParams, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#ff6b35]/30 border-t-[#ff6b35] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">결제를 확인하고 있어요...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-6">
        <div className="bg-white rounded-2xl p-10 max-w-sm w-full text-center shadow-sm border border-gray-100">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-medium text-[#372a14] mb-3">결제 확인 실패</h2>
          <p className="text-gray-500 text-sm mb-8">{message}</p>
          <Link href="/stay" className="inline-block bg-[#372a14] text-white px-8 py-3 rounded-full text-sm hover:bg-[#ff6b35] transition-colors">
            다시 시도하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-6">
      <div className="bg-white rounded-2xl p-10 max-w-sm w-full text-center shadow-sm border border-gray-100">
        <div className="text-5xl mb-5">🌿</div>
        <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-3 font-medium">Payment Complete</p>
        <h2 className="text-2xl font-light text-[#372a14] mb-3">결제가 완료됐어요</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          예약이 확정됐습니다.<br />
          이메일로 확인 안내를 보내드렸어요.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/stay"
            className="bg-[#372a14] text-white py-3 rounded-full text-sm font-medium hover:bg-[#ff6b35] transition-colors"
          >
            스테이로 돌아가기
          </Link>
          <Link
            href="/"
            className="text-gray-400 text-sm hover:text-[#372a14] transition-colors"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="w-12 h-12 border-2 border-[#ff6b35]/30 border-t-[#ff6b35] rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
