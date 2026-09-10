import Image from "next/image";
import Link from "next/link";
import HomePrograms from "@/components/HomePrograms";
export default function Home() {
  return (
    <div className="bg-[#faf9f7]">

      {/* ── 1. Hero: 타입 + 사진 분할 ── */}
      <section className="min-h-screen flex flex-col md:flex-row">

        {/* 왼쪽: 타이포그래피 */}
        <div className="flex-1 bg-[#372a14] flex flex-col justify-between px-8 md:px-16 pt-28 md:pt-32 pb-12 md:pb-16">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-10 font-medium">
              Andong, Korea · 경북 안동
            </p>
            <h1 className="text-[clamp(3.5rem,9vw,8rem)] font-light text-white tracking-tight leading-[0.92] mb-10">
              코이<br />노니아
            </h1>
            <p className="text-white/40 text-sm md:text-base leading-relaxed max-w-xs">
              일, 놀이, 쉼의 조화로<br />
              문화를 전파하는 공간.<br />
              <span className="text-white/20 text-xs">A cultural space in Andong.</span>
            </p>
          </div>

          {/* 하단 메뉴 링크 */}
          <div className="flex flex-col gap-3 mt-16">
            {[
              { href: "/about",  label: "코이노니아",  en: "About"  },
              { href: "/salon",  label: "살롱",        en: "Salon"  },
              { href: "/stay",   label: "스테이",      en: "Stay"   },
              { href: "/store",  label: "스토어",      en: "Store"  },
              { href: "/andong", label: "안동 가이드", en: "Andong" },
            ].map((item) => (
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
            ))}
          </div>
        </div>

        {/* 오른쪽: 사진 3장 세로 모자이크 */}
        <div className="w-full md:w-[42%] flex flex-row md:flex-col h-72 md:h-auto">
          <div className="relative flex-1 overflow-hidden">
            <Image
              src="/images/hero/hero-cup.jpeg"
              alt="코이노니아"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="relative flex-1 overflow-hidden">
            <Image
              src="/images/hero/hero-salon.jpeg"
              alt="살롱"
              fill
              className="object-cover object-center"
              priority
            />
            <div className="absolute inset-0 bg-[#372a14]/20" />
          </div>
          <div className="relative flex-1 overflow-hidden hidden md:block">
            <Image
              src="/images/hero/hero-books.jpg"
              alt="책"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-[#372a14]/10" />
          </div>
        </div>
      </section>

      {/* ── 2. 살롱 + 스테이: 교차 에디토리얼 ── */}
      {[
        {
          href: "/salon",
          label: "살롱",
          en: "Salon",
          tagline: "경계 없이 열린 모임의 자리",
          taglineEn: "An open space for gathering",
          img: "/images/salon/living-1.jpg",
        },
        {
          href: "/stay",
          label: "스테이",
          en: "Stay",
          tagline: "안동에서 진짜 쉬어가세요",
          taglineEn: "Rest, truly, in Andong",
          img: "/images/stay/yeutae-2.jpg",
        },
      ].map((s, i) => (
        <Link
          key={s.href}
          href={s.href}
          className={`group flex flex-col md:flex-row ${i % 2 === 1 ? "md:flex-row-reverse" : ""} min-h-[55vh] overflow-hidden`}
        >
          <div className="relative flex-1 h-64 md:h-auto overflow-hidden">
            <Image
              src={s.img}
              alt={s.label}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              sizes="(max-width: 768px) 100vw, 60vw"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors duration-500" />
          </div>
          <div className="flex-none w-full md:w-72 lg:w-80 bg-[#372a14] text-white flex flex-col justify-center px-8 md:px-12 py-12 md:py-0">
            <p className="text-white/30 text-xs tracking-[0.3em] uppercase mb-5">{s.en}</p>
            <h2 className="text-5xl font-light mb-5">{s.label}</h2>
            <p className="text-white/55 text-sm leading-relaxed mb-1">{s.tagline}</p>
            <p className="text-white/25 text-xs mb-10">{s.taglineEn}</p>
            <span className="text-[#ff6b35] text-sm font-medium flex items-center gap-2 group-hover:gap-4 transition-all duration-300">
              자세히 보기 <span>→</span>
            </span>
          </div>
        </Link>
      ))}

      {/* ── 3. 이번 달 프로그램 미리보기 ── */}
      <HomePrograms />

      {/* ── 4. 스토어 + 안동 ── */}
      <div className="flex flex-col md:flex-row min-h-[45vh]">
        {/* 스토어 */}
        <Link
          href="/store"
          className="group relative flex-1 overflow-hidden bg-[#fffbde] flex flex-col justify-end p-10 md:p-14 min-h-[38vh]"
        >
          <div className="absolute inset-0 flex items-end overflow-hidden opacity-15 pointer-events-none">
            <div className="flex gap-0.5">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="w-3.5 rounded-t-sm shrink-0"
                  style={{
                    height: `${55 + (i * 41 + 17) % 85}px`,
                    background: `hsl(${(i * 53 + 30) % 360}, 35%, 48%)`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-[#372a14]/35 text-xs tracking-[0.3em] uppercase mb-4">Store</p>
            <h2 className="text-4xl font-light text-[#372a14] mb-4">스토어</h2>
            <p className="text-[#372a14]/55 text-sm leading-relaxed mb-7">
              코이노니아가 고른 시집·소설·에세이<br />
              140+권의 큐레이션 북 리스트.
            </p>
            <span className="text-[#ff6b35] text-sm font-medium flex items-center gap-2 group-hover:gap-4 transition-all duration-300">
              책 둘러보기 →
            </span>
          </div>
        </Link>

        {/* 안동 가이드 */}
        <Link
          href="/andong"
          className="group relative flex-1 overflow-hidden min-h-[38vh]"
        >
          <Image
            src="/images/about/andong-house.jpg"
            alt="안동"
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute bottom-10 left-10">
            <p className="text-white/35 text-xs tracking-[0.3em] uppercase mb-4">Andong Guide</p>
            <h2 className="text-4xl font-light text-white mb-4">안동 가이드</h2>
            <p className="text-white/45 text-sm mb-7">
              안동은 빠르지 않습니다.<br />그게 좋습니다.
            </p>
            <span className="text-[#ff6b35] text-sm font-medium flex items-center gap-2 group-hover:gap-4 transition-all duration-300">
              가이드 보기 →
            </span>
          </div>
        </Link>
      </div>

      {/* ── 4. 코이노니아 소개 배너 ── */}
      <Link
        href="/about"
        className="group block bg-[#372a14] px-8 md:px-16 py-16 md:py-20"
      >
        <div className="max-w-5xl flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div>
            <p className="text-white/25 text-xs tracking-[0.3em] uppercase mb-5">About</p>
            <h2 className="text-3xl md:text-5xl font-light text-white leading-tight">
              코이노니아는<br />
              <em className="not-italic text-[#ff6b35]">무엇인가요?</em>
            </h2>
          </div>
          <div className="max-w-sm">
            <p className="text-white/45 text-sm leading-relaxed mb-6">
              이곳에서 우리는 마음껏 웃고 깊이 사유하며<br />
              이룰 수 없는 꿈을 꿔요.<br />
              안동 지역의 사랑방.
            </p>
            <span className="text-white/40 text-sm group-hover:text-[#ff6b35] transition-colors duration-300 flex items-center gap-2">
              코이노니아 이야기
              <span className="group-hover:translate-x-2 transition-transform duration-300 inline-block">→</span>
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
