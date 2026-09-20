"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function FestivalPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 오늘 이미 닫은 경우 띄우지 않음
    try {
      const closed = localStorage.getItem("talchum-popup-closed");
      if (closed === new Date().toDateString()) return;
    } catch {}
    setVisible(true);
  }, []);

  const close = () => {
    try {
      localStorage.setItem("talchum-popup-closed", new Date().toDateString());
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
        {/* 닫기 버튼 */}
        <button
          onClick={close}
          className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none transition-colors"
          aria-label="닫기"
        >
          ×
        </button>

        {/* 포스터 이미지 — 클릭 시 탈춤축제 페이지로 */}
        <Link href="/talchum" onClick={close}>
          <Image
            src="/images/talchum-festival-poster.png"
            alt="안동국제탈춤페스티벌 × 코이노니아 살롱"
            width={600}
            height={750}
            className="w-full h-auto cursor-pointer"
            priority
          />
        </Link>

        {/* 하단 버튼 */}
        <div className="flex">
          <button
            onClick={close}
            className="flex-1 bg-white/90 text-gray-500 text-sm py-3 hover:bg-white transition-colors"
          >
            오늘 하루 안 보기
          </button>
          <Link
            href="/talchum"
            onClick={close}
            className="flex-1 bg-[#ff6b35] text-white text-sm py-3 text-center font-medium hover:bg-[#e55a25] transition-colors"
          >
            프로그램 보러가기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
