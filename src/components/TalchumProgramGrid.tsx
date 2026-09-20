"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

/**
 * 탈춤축제 프로그램 소개 — 썸네일 그리드에서 고르고, 자세한 내용은 모달로 연다.
 * 카드뉴스 원문을 그대로 싣되 목록에서는 한 줄로 줄여 늘어지지 않게 한다.
 */
export type ProgramCard = {
  imgs?: string[];
  title: string;
  /** 목록용 짧은 일정 */
  when: string;
  /** 모달용 전체 일정 */
  whenFull?: string;
  /** 목록용 짧은 금액 */
  price: string;
  /** 모달에서만 보여줄 금액 단서 */
  priceNote?: string;
  body: string;
  note?: string;
  badge?: string;
  externalForm?: { url: string; label: string };
};

export default function TalchumProgramGrid({ cards }: { cards: ProgramCard[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex === null ? null : cards[openIndex];

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenIndex(null); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
        {cards.map((c, i) => (
          <button
            key={c.title + c.when}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="text-left group"
          >
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-[#f0efe6] mb-3">
              {c.imgs?.[0] && (
                <Image
                  src={`/images/talchum/${c.imgs[0]}`}
                  alt={c.title}
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                />
              )}
              {c.badge && (
                <span className="absolute top-2 left-2 text-[10px] bg-white/90 text-[#296973] px-2 py-0.5 rounded-full font-semibold">
                  {c.badge}
                </span>
              )}
            </div>
            <p className="font-medium text-[#372a14] text-sm leading-snug group-hover:text-[#ff6b35] transition-colors">
              {c.title}
            </p>
            <p className="text-xs text-[#296973] mt-1">{c.when}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.price}</p>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 md:p-8"
          onClick={() => setOpenIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 md:px-8 pt-6 pb-4 sticky top-0 bg-white border-b border-gray-100">
              <div>
                {open.badge && (
                  <span className="inline-block text-[10px] bg-[#296973]/10 text-[#296973] px-2 py-0.5 rounded-full font-semibold mb-2">
                    {open.badge}
                  </span>
                )}
                <h3 className="text-xl md:text-2xl font-medium text-[#372a14]">{open.title}</h3>
                <p className="text-xs text-[#296973] font-semibold mt-1.5">
                  {open.whenFull ?? open.when}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{open.priceNote ?? open.price}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                aria-label="닫기"
                className="shrink-0 w-8 h-8 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 md:px-8 py-6">
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{open.body}</p>
              {open.note && <p className="text-xs text-gray-400 mt-4">{open.note}</p>}

              {open.externalForm && (
                <a
                  href={open.externalForm.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-block bg-[#296973] text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#1e5059] transition-colors"
                >
                  {open.externalForm.label} →
                </a>
              )}

              {open.imgs && open.imgs.length > 0 && (
                <div className="mt-6 space-y-3">
                  {open.imgs.map((src) => (
                    <Image
                      key={src}
                      src={`/images/talchum/${src}`}
                      alt={`${open.title} 안내`}
                      width={900}
                      height={1125}
                      className="w-full h-auto rounded-xl"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
