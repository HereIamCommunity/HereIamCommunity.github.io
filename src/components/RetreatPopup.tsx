"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function RetreatPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("retreat-popup-v2");
    if (!dismissed) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("retreat-popup-v2", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5"
      onClick={dismiss}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* 포스터 */}
      <div
        className="relative z-10 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={dismiss}
          className="self-end mb-2 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 transition-colors flex items-center justify-center text-white text-lg leading-none"
          aria-label="닫기"
        >
          ×
        </button>

        {/* 포스터 이미지 — 클릭 시 신청 페이지 이동 */}
        <Link href="/retreat" onClick={dismiss}>
          <div className="relative w-[min(88vw,380px)] shadow-2xl rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.01] transition-transform duration-200">
            <Image
              src="/retreat/poster.png"
              alt="코이노니아 72시간 썸머캠프"
              width={380}
              height={540}
              className="w-full h-auto"
              priority
            />
          </div>
        </Link>

        {/* 하단 텍스트 */}
        <p className="mt-3 text-white/80 text-sm">
          72시간 썸머캠프 신청을 원한다면 이미지를 클릭해 주세요
        </p>
        <button
          onClick={dismiss}
          className="mt-2 text-white/40 text-xs hover:text-white/70 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
