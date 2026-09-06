"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

type MenuItem = { href: string; kr: string; en: string; badge?: string };

const menuItems: MenuItem[] = [
  { href: "/about",   kr: "코이노니아", en: "Story"   },
  { href: "/stay",    kr: "스테이",     en: "Stay"    },
  { href: "/salon",   kr: "살롱",       en: "Salon"   },
  { href: "/retreat", kr: "썸머캠프",   en: "Camp",   badge: "NEW" },
  { href: "/store",   kr: "스토어",     en: "Store"   },
  // { href: "/andong",  kr: "안동 가이드", en: "Andong"  }, // 임시 비공개
];

export default function Nav() {
  const [open, setOpen]       = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname              = usePathname();
  const isHome                = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 메뉴 열리면 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // 홈+미스크롤 = 투명, 그 외 = 흰 배경
  const transparent = isHome && !scrolled && !open;

  return (
    <>
      {/* ── 상단 바 ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between
          px-5 md:px-8 h-14 md:h-16 transition-colors duration-300
          ${transparent ? "bg-transparent" : "bg-white/95 backdrop-blur-sm shadow-sm"}`}
      >
        {/* 로고 */}
        <Link href="/" onClick={() => setOpen(false)}>
          <Image
            src={transparent ? "/logo-white.png" : "/logo-color.png"}
            alt="koinonia"
            width={110}
            height={30}
            className="h-7 w-auto"
            priority
          />
        </Link>

        {/* 햄버거 */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="메뉴"
          className="relative z-[60] flex flex-col items-center justify-center gap-[5px] w-9 h-9"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`block w-5 h-px transition-all duration-300
                ${open
                  ? i === 1
                    ? "opacity-0"
                    : i === 0
                    ? "rotate-45 translate-y-[6px] bg-white"
                    : "-rotate-45 -translate-y-[6px] bg-white"
                  : transparent
                  ? "bg-white"
                  : "bg-[#372a14]"
                }`}
            />
          ))}
        </button>
      </nav>

      {/* ── 풀스크린 오버레이 ── */}
      <div
        className={`fixed inset-0 z-40 bg-[#372a14] flex flex-col justify-center
          px-8 md:px-16 transition-opacity duration-500
          ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <ul className="space-y-1 md:space-y-2 mb-14">
          {menuItems.map((item, i) => (
            <li
              key={item.href}
              style={{
                transform: open ? "translateY(0)" : "translateY(16px)",
                opacity:   open ? 1 : 0,
                transition: `transform 0.4s ease ${i * 55}ms, opacity 0.4s ease ${i * 55}ms`,
              }}
            >
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="group flex items-baseline gap-5 py-2"
              >
                <span className="text-white/30 text-[10px] tracking-[0.2em] uppercase w-14 shrink-0 group-hover:text-white/60 transition-colors">
                  {item.en}
                </span>
                <span className="text-white text-3xl md:text-5xl font-light tracking-tight group-hover:text-[#ff6b35] transition-colors duration-200">
                  {item.kr}
                </span>
                {item.badge && (
                  <span className="self-center text-[9px] bg-[#ff6b35] text-white px-1.5 py-0.5 rounded font-bold tracking-wider">
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        {/* 하단 정보 */}
        <div
          className="border-t border-white/10 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-3"
          style={{ opacity: open ? 1 : 0, transition: "opacity 0.4s ease 0.35s" }}
        >
          <a
            href="https://instagram.com/koinonia_andong"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 text-sm hover:text-white transition-colors"
          >
            @koinonia_andong
          </a>
          <span className="text-white/20 text-sm">경북 안동</span>
        </div>
      </div>
    </>
  );
}
