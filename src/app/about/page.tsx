import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "코이노니아 | About",
  description: "이곳에서 우리는 마음껏 웃고 깊이 사유하며 이룰 수 없는 꿈을 꿔요. 경북 안동의 사랑방, 코이노니아.",
};

export default function AboutPage() {
  return (
    <div className="pt-14 md:pt-16">
      {/* Full-bleed hero */}
      <section className="relative h-[70vh] min-h-[480px] flex items-end overflow-hidden">
        <Image
          src="/images/hero/exterior-1.jpg"
          alt="코이노니아"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="relative z-10 px-6 md:px-16 pb-16 max-w-6xl mx-auto w-full">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-5 font-medium">
            About · 코이노니아
          </p>
          <h1 className="text-4xl md:text-7xl font-light text-white tracking-tight leading-none mb-6">
            κοινωνία
          </h1>
          <p className="text-white/70 text-base md:text-lg max-w-lg leading-relaxed">
            그리스어로 &lsquo;교제, 환대&rsquo;. 경북 안동의 커뮤니티 공간.
          </p>
        </div>
      </section>

      {/* Core statement */}
      <section className="py-24 px-6 md:px-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-6 font-medium">Our Story</p>
              <h2 className="text-3xl md:text-4xl font-light text-[#372a14] leading-tight mb-0">
                이곳에서 우리는<br />
                마음껏 웃고 깊이<br />
                사유하며 꿈을 꿔요.
              </h2>
            </div>
            <div className="pt-0 md:pt-16">
              <p className="text-gray-600 leading-relaxed text-base mb-6">
                다양한 실험이 전개되는 이곳은 안동 지역의 사랑방이에요.
                일하고, 함께 밥을 먹고, 좋은 것을 나누고, 쉬어가는 곳.
              </p>
              <p className="text-gray-500 leading-relaxed text-sm">
                We experiment with living differently — with intention, with community, with joy.
                Koinonia is a cultural salon, stay, and store in Andong, North Gyeongsang Province.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three pillars — minimal */}
      <section className="py-20 px-6 md:px-16 bg-[#372a14] text-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-16 font-medium">
            What We Do
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
            {[
              {
                en: "Work",
                kr: "일",
                desc: "대도시가 아닌 로컬에서 자신만의 방식으로 의미 있는 일을 만드는 것.",
                href: "/salon",
                linkLabel: "살롱 프로그램 →",
              },
              {
                en: "Play",
                kr: "놀이",
                desc: "수요 포틀럭, 프라이데이나잇. 경계 없이 만나 이야기 나누며 함께 어울리는 시간.",
                href: "/salon",
                linkLabel: "프로그램 보기 →",
              },
              {
                en: "Rest",
                kr: "쉼",
                desc: "안동의 고즈넉한 시간 속에서 나른하게 쉬어가는 여정.",
                href: "/stay",
                linkLabel: "스테이 예약 →",
              },
            ].map((p) => (
              <div key={p.kr} className="p-10 bg-[#372a14]">
                <p className="text-white/30 text-xs tracking-[0.25em] uppercase mb-4">{p.en}</p>
                <h3 className="text-4xl font-light text-white mb-6">{p.kr}</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-8">{p.desc}</p>
                <Link
                  href={p.href}
                  className="text-[#ff6b35] text-sm hover:text-white transition-colors"
                >
                  {p.linkLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo grid — ambient */}
      <section className="py-20 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-12 font-medium">
            The Space
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { src: "/images/salon/living-1.jpg", span: "col-span-2 row-span-2 aspect-[4/3]" },
              { src: "/images/stay/nagnae-1.jpg", span: "col-span-1 aspect-square" },
              { src: "/images/salon/bar.jpg", span: "col-span-1 aspect-square" },
              { src: "/images/stay/yeutae-1.jpg", span: "col-span-1 aspect-[4/3]" },
              { src: "/images/stay/kitchen.jpg", span: "col-span-1 aspect-[4/3]" },
              { src: "/images/about/andong-house.jpg", span: "col-span-1 aspect-[4/3]" },
            ].map((img, i) => (
              <div key={i} className={`relative rounded-lg overflow-hidden ${img.span}`}>
                <Image
                  src={img.src}
                  alt={`코이노니아 ${i + 1}`}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership — editorial */}
      <section className="py-24 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#296973] text-xs tracking-[0.3em] uppercase mb-6 font-medium">
                Membership
              </p>
              <h2 className="text-3xl md:text-4xl font-light text-[#372a14] leading-tight mb-8">
                멤버십 <span className="italic">&lsquo;곁&rsquo;</span>
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                곁에 있다는 것은 그냥 가까이 있는 게 아닙니다.<br />
                함께 성장하고, 서로를 지지하며, 같은 문화를 만들어 가는 관계입니다.
              </p>
              <p className="text-gray-400 text-sm leading-relaxed mb-10">
                Uncommon bond. Andong, South Korea. Beyond comfort.
              </p>
              <ul className="space-y-3 mb-10">
                {[
                  ["살롱 프로그램 무료 참여", "Free access to all salon programs"],
                  ["스테이 20% 할인", "20% off all stays"],
                  ["코이노니아 커뮤니티", "Community network"],
                  ["정기 멤버 모임", "Regular member gatherings"],
                ].map(([kr, en]) => (
                  <li key={kr} className="flex items-start gap-4">
                    <span className="text-[#ff6b35] mt-1 text-sm">—</span>
                    <div>
                      <span className="text-[#372a14] text-sm font-medium">{kr}</span>
                      <span className="text-gray-400 text-xs ml-2">{en}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href="https://instagram.com/koinonia_andong"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-[#372a14] text-white font-medium px-8 py-3 rounded-full hover:bg-[#ff6b35] transition-colors text-sm"
              >
                멤버십 문의 (Instagram DM)
              </a>
            </div>
            <div className="relative h-96 rounded-2xl overflow-hidden">
              <Image
                src="/images/about/guestbook-1.jpg"
                alt="방명록"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-[#296973]/10 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-20 px-6 md:px-16 bg-[#372a14] text-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-6 font-medium">
                Location
              </p>
              <h2 className="text-3xl md:text-4xl font-light leading-tight mb-8">
                경북 안동시<br />중앙로 57
              </h2>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                57 Jungang-ro, Andong-si, Gyeongsangbuk-do
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/stay"
                  className="inline-block bg-[#ff6b35] text-white font-medium px-8 py-3 rounded-full hover:bg-[#e55a25] transition-colors text-sm text-center"
                >
                  스테이 예약
                </Link>
                <Link
                  href="/andong"
                  className="inline-block border border-white/30 text-white font-medium px-8 py-3 rounded-full hover:border-white transition-colors text-sm text-center"
                >
                  안동 가이드
                </Link>
              </div>
            </div>
            <div className="relative h-80 rounded-2xl overflow-hidden">
              <Image
                src="/images/hero/exterior-2.jpg"
                alt="코이노니아 외관"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
