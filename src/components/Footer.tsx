import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#372a14] text-white/70">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Image
              src="/logo-white.png"
              alt="koinonia"
              width={120}
              height={32}
              className="h-8 w-auto mb-5"
            />
            <p className="text-sm leading-relaxed text-white/50">
              일, 놀이, 쉼의 조화.<br />
              안동에서 문화를 전파하는 공간.<br />
              <span className="text-white/30 text-xs">A cultural space in Andong.</span>
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white/90 font-medium mb-4 text-sm tracking-wide">바로가기</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/about" className="hover:text-[#ff6b35] transition-colors">
                  코이노니아 · About
                </Link>
              </li>
              <li>
                <Link href="/salon" className="hover:text-[#ff6b35] transition-colors">
                  살롱 · Salon
                </Link>
              </li>
              <li>
                <Link href="/stay" className="hover:text-[#ff6b35] transition-colors">
                  스테이 · Stay
                </Link>
              </li>
              <li>
                <Link href="/store" className="hover:text-[#ff6b35] transition-colors">
                  스토어 · Store
                </Link>
              </li>
              <li>
                <Link href="/andong" className="hover:text-[#ff6b35] transition-colors">
                  안동 가이드 · Andong
                </Link>
              </li>
              <li>
                <Link href="/booking-check" className="hover:text-[#ff6b35] transition-colors">
                  예약 확인
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white/90 font-medium mb-4 text-sm tracking-wide">연락처</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://instagram.com/koinonia_andong"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-[#ff6b35] transition-colors group"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-60 group-hover:opacity-100">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  @koinonia_andong
                </a>
              </li>
              <li>
                <a
                  href="mailto:koinonia2026@naver.com"
                  className="hover:text-[#ff6b35] transition-colors"
                >
                  koinonia2026@naver.com
                </a>
              </li>
            </ul>
          </div>

          {/* Location */}
          <div>
            <h4 className="text-white/90 font-medium mb-4 text-sm tracking-wide">위치</h4>
            <address className="not-italic text-sm space-y-1">
              <p>경상북도 안동시 중앙로 57</p>
              <p className="text-white/40 text-xs">57 Jungang-ro, Andong</p>
              <p className="text-white/40 text-xs">Gyeongsangbuk-do, Korea</p>
            </address>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/30">
          <span>© 2025 koinonia. All rights reserved.</span>
          <span>경북 안동의 살롱 · 스테이 · 스토어</span>
        </div>
      </div>
    </footer>
  );
}
