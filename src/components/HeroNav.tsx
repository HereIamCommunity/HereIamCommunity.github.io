"use client";

import { useState } from "react";
import Link from "next/link";

type NavItem =
  | { href: string; label: string; en: string; sub?: never }
  | { href?: never; label: string; en: string; sub: { href: string; label: string; en: string }[] };

const items: NavItem[] = [
  { href: "/about",  label: "코이노니아", en: "About"   },
  { href: "/salon",  label: "살롱",       en: "Salon"   },
  { href: "/stay",   label: "스테이",     en: "Stay"    },
  { href: "/store",  label: "스토어",     en: "Store"   },
  { href: "/andong", label: "투어",       en: "Tour"    },
  {
    label: "아카이브", en: "Archive",
    sub: [
      { href: "/talchum", label: "탈춤축제", en: "Festival" },
      { href: "/retreat",  label: "썸머캠프", en: "Camp"     },
    ],
  },
];

export default function HeroNav() {
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 mt-16">
      {items.map((item) =>
        item.sub ? (
          <div key="archive">
            <button
              type="button"
              onClick={() => setArchiveOpen((v) => !v)}
              className="group flex items-center justify-between border-t border-white/10 pt-3 hover:border-[#ff6b35]/40 transition-colors w-full text-left"
            >
              <span className="text-white/70 text-base font-light group-hover:text-white transition-colors">
                {item.label}
              </span>
              <span className="flex items-center gap-2">
                <span className={`text-white/20 text-xs tracking-widest uppercase group-hover:text-[#ff6b35] transition-colors`}>
                  {item.en}
                </span>
                <span className={`text-white/30 text-sm transition-transform duration-300 ${archiveOpen ? "rotate-45" : ""}`}>
                  +
                </span>
              </span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${archiveOpen ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}`}>
              {item.sub.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className="group flex items-center justify-between border-t border-white/5 pt-2.5 mt-2 pl-3 hover:border-[#ff6b35]/30 transition-colors"
                >
                  <span className="text-white/50 text-sm font-light group-hover:text-white/80 transition-colors">
                    {sub.label}
                  </span>
                  <span className="text-white/15 text-xs tracking-widest uppercase group-hover:text-[#ff6b35] transition-colors">
                    {sub.en} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center justify-between border-t border-white/10 pt-3 hover:border-[#ff6b35]/40 transition-colors"
          >
            <span className="text-white/70 text-base font-light group-hover:text-white transition-colors">
              {item.label}
            </span>
            <span className="text-white/20 text-xs tracking-widest uppercase group-hover:text-[#ff6b35] transition-colors">
              {item.en} →
            </span>
          </Link>
        )
      )}
    </div>
  );
}
