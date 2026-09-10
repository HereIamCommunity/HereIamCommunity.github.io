"use client";

import Link from "next/link";
import { PROGRAMS } from "@/lib/programs";

const TYPE_LABEL: Record<string, string> = {
  potluck: "수요 포틀럭",
  friday: "프라이데이나잇",
  special: "스페셜 살롱",
};

export default function HomePrograms() {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = PROGRAMS
    .filter((p) => p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  if (upcoming.length === 0) return null;

  return (
    <section className="bg-[#faf9f7] px-6 md:px-16 py-14 md:py-18">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-2 font-medium">
              이번 달 살롱
            </p>
            <h2 className="text-2xl md:text-3xl font-light text-[#372a14]">
              다가오는 프로그램
            </h2>
          </div>
          <Link
            href="/salon"
            className="text-sm text-gray-400 hover:text-[#ff6b35] transition-colors flex items-center gap-1 shrink-0 mb-1"
          >
            전체 보기 →
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 md:mx-0 px-6 md:px-0 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
          {upcoming.map((p) => (
            <Link
              key={p.id}
              href="/salon"
              className="flex-none w-64 md:w-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-[#ff6b35]/20 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-medium text-[#ff6b35]/70 bg-[#ff6b35]/8 px-2.5 py-1 rounded-full">
                  {TYPE_LABEL[p.type] ?? p.type}
                </span>
                <span className="text-sm font-bold text-[#372a14]">
                  {p.price === 0 ? "무료" : `${p.price.toLocaleString()}원`}
                </span>
              </div>
              <p className="font-semibold text-[#372a14] text-base mb-1 group-hover:text-[#ff6b35] transition-colors leading-snug">
                {p.title}
              </p>
              {p.subtitle && (
                <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">
                  {p.subtitle}
                </p>
              )}
              <p className="text-gray-500 text-xs mt-auto">
                {p.dateLabel}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
