"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

// 10/21 23:59 KST
const EXPIRY = new Date("2026-10-21T23:59:59+09:00");

export default function PotluckPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (new Date() >= EXPIRY) return;
    const dismissed = sessionStorage.getItem("potluck-popup-dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem("potluck-popup-dismissed", "1");
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="relative max-w-sm w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <Link href="/salon" onClick={dismiss}>
          <Image
            src="/images/potluck-popup.webp"
            alt="수요포틀럭 with 진저고유 시음회"
            width={800}
            height={1000}
            className="w-full h-auto rounded-xl shadow-2xl"
            priority
          />
        </Link>
        <button
          onClick={dismiss}
          aria-label="닫기"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white text-lg hover:bg-black/70 transition-colors"
        >
          ×
        </button>
        <p className="text-center text-white/60 text-xs mt-3">
          클릭하면 살롱 신청 페이지로 이동해요
        </p>
      </div>
    </div>
  );
}
