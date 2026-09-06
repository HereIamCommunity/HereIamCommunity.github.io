"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const message = searchParams.get("message") ?? "결제가 취소되었습니다.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-6">
      <div className="bg-white rounded-2xl p-10 max-w-sm w-full text-center shadow-sm border border-gray-100">
        <div className="text-4xl mb-5">😔</div>
        <p className="text-gray-400 text-xs tracking-[0.3em] uppercase mb-3">Payment Failed</p>
        <h2 className="text-xl font-light text-[#372a14] mb-3">결제가 완료되지 않았어요</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-2">{message}</p>
        {code && <p className="text-gray-300 text-xs mb-8">오류 코드: {code}</p>}
        <div className="flex flex-col gap-3">
          <Link
            href="/stay"
            className="bg-[#372a14] text-white py-3 rounded-full text-sm font-medium hover:bg-[#ff6b35] transition-colors"
          >
            다시 예약하기
          </Link>
          <Link href="/" className="text-gray-400 text-sm hover:text-[#372a14] transition-colors">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#faf9f7]" />}>
      <FailContent />
    </Suspense>
  );
}
