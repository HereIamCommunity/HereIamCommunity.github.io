"use client";

import { loadTossPayments, ANONYMOUS, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";

function PaymentContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const amount = Number(searchParams.get("amount") ?? 0);
  const customerName = searchParams.get("name") ?? "";
  const backTo = searchParams.get("backTo") ?? "/salon";

  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!orderId || !amount) return;
    if (!CLIENT_KEY) {
      console.error("[TOSS] NEXT_PUBLIC_TOSS_CLIENT_KEY 환경변수가 설정되지 않았습니다.");
      return;
    }

    async function init() {
      const tossPayments = await loadTossPayments(CLIENT_KEY);
      const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });

      await widgets.setAmount({ value: amount, currency: "KRW" });
      await widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" });
      await widgets.renderAgreement({ selector: "#agreement", variantKey: "DEFAULT" });

      widgetsRef.current = widgets;
      setReady(true);
    }

    init().catch(console.error);
  }, [orderId, amount]);

  async function handlePay() {
    if (!widgetsRef.current || paying) return;
    setPaying(true);
    try {
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: "코이노니아 살롱 참가비",
        customerName,
        successUrl: `${window.location.origin}/payment/success?backTo=${encodeURIComponent(backTo)}`,
        failUrl: `${window.location.origin}/payment/fail?backTo=${encodeURIComponent(backTo)}`,
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code !== "USER_CANCEL") {
        console.error(e);
      }
      setPaying(false);
    }
  }

  if (!orderId || !amount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <p className="text-gray-500 text-sm">결제 정보가 올바르지 않습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] py-12 px-6">
      <div className="max-w-md mx-auto">
        <Link
          href={backTo}
          className="text-sm text-gray-400 hover:text-gray-600 mb-8 flex items-center gap-1 transition-colors"
        >
          ← 뒤로 가기
        </Link>

        <div className="mb-8">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase font-medium mb-2">
            Card Payment
          </p>
          <h1 className="text-2xl font-light text-[#372a14]">결제하기</h1>
          <p className="text-sm text-gray-400 mt-1">
            결제 금액:{" "}
            <span className="font-semibold text-[#372a14]">
              {amount.toLocaleString()}원
            </span>
          </p>
        </div>

        <div id="payment-method" />
        <div id="agreement" className="mt-4" />

        {!CLIENT_KEY ? (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm text-center">
            <p className="font-medium text-yellow-800 mb-2">결제 키 미설정</p>
            <p className="text-yellow-700 text-xs leading-relaxed">
              Vercel 대시보드 &gt; Settings &gt; Environment Variables에<br />
              <code className="font-mono bg-yellow-100 px-1 rounded">NEXT_PUBLIC_TOSS_CLIENT_KEY</code>를 추가해주세요.<br />
              (토스페이먼츠 &gt; 개발자센터 &gt; 주문서형 클라이언트 키)
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handlePay}
              disabled={!ready || paying}
              className="w-full mt-6 bg-[#ff6b35] text-white font-semibold py-4 rounded-xl hover:bg-[#e55a25] transition-colors disabled:opacity-50"
            >
              {paying
                ? "결제 처리 중..."
                : ready
                  ? `${amount.toLocaleString()}원 결제하기`
                  : "결제 모듈 로딩 중..."}
            </button>
            <p className="text-xs text-gray-400 text-center mt-4">
              토스페이먼츠 보안 결제 · 카드 · 간편결제 지원
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
          <div className="w-12 h-12 border-2 border-[#ff6b35]/30 border-t-[#ff6b35] rounded-full animate-spin" />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}
