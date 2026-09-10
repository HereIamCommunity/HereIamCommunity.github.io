import Image from "next/image";
import Link from "next/link";
import StayBookingForm from "@/components/StayBookingForm";

export const metadata = {
  title: "스테이 | 코이노니아 안동",
  description: "나그네방, 옥순방, 여태방. 안동 코이노니아에서 진짜 쉬어가세요.",
};

const rooms = [
  {
    id: "nagnae",
    name: "나그네방",
    en: "Nagnae Room",
    price: 60000,
    capacity: "1인 / 1 guest",
    roomImg: "/images/stay/nagnae-1.jpg",
    commonImg: "/images/stay/stay-sofa.jpg",
    features: ["싱글 침대", "개인 수납", "아담한 방"],
    desc: "혼자 길을 떠난 나그네를 위한 방. 작지만 따뜻하고, 조용하게 자신만의 시간을 보내기에 딱 좋습니다.",
    descEn: "A room for the lone traveler. Small but warm — the perfect place to be with yourself.",
  },
  {
    id: "oksun",
    name: "옥순방",
    en: "Oksun Room",
    price: 120000,
    capacity: "1~2인 / 1–2 guests",
    roomImg: "/images/stay/oksun-1.jpg",
    commonImg: "",
    features: ["퀸사이즈 침대", "에어컨", "여유로운 방"],
    desc: "맑고 차분한 방. 혼자도, 둘이도 편안하게 지낼 수 있는 균형 잡힌 공간입니다.",
    descEn: "Clear and calm. Comfortable alone or with someone you love.",
  },
  {
    id: "yeutae",
    name: "여태방",
    en: "Yeutae Room",
    price: 160000,
    capacity: "최대 4인 / up to 4 guests",
    roomImg: "/images/stay/yeutae-1.jpg",
    commonImg: "/images/about/guestbook-1.jpg",
    features: ["넓은 공간", "여유로운 구성", "공용 주방"],
    desc: "여럿이 여유롭고 넉넉하게 머무는 도미토리룸.",
    descEn: "Rest like never before. A spacious dormitory room for unhurried, generous stays.",
  },
];

export default function StayPage() {
  return (
    <div className="pt-14 md:pt-16">
      {/* Hero */}
      <section className="relative h-[65vh] min-h-[420px] flex items-end overflow-hidden">
        <Image
          src="/images/stay/yeutae-2.jpg"
          alt="코이노니아 스테이"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="relative z-10 px-6 md:px-16 pb-14 max-w-6xl mx-auto w-full">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-4 font-medium">
            Stay · 스테이
          </p>
          <h1 className="text-4xl md:text-6xl font-light text-white tracking-tight leading-none mb-4">
            코이노니아 스테이
          </h1>
          <p className="text-white/60 text-base max-w-md">
            안동에서 진짜 쉬어가세요. 각자의 이름과 이야기를 가진 세 개의 방.
          </p>
        </div>
      </section>

      {/* 스테이 소개 */}
      <section className="py-24 px-6 md:px-16 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-10 font-medium">KOINONIA STAY</p>
          <div className="space-y-7">
            <p className="text-xl md:text-2xl font-light text-[#372a14] leading-relaxed tracking-tight">
              이곳은 할아버지, 할머니가 머무셨던<br />
              오래된 건물을 손녀딸이 손수<br />
              리모델링해 만든 공간입니다.
            </p>
            <div className="w-8 h-px bg-[#372a14]/20 mx-auto" />
            <p className="text-gray-500 leading-loose text-base">
              고즈넉한 집의 결은 남기되,<br />
              머무는 데 불편함이 없도록<br />
              공간 하나하나를 차분히 손보았습니다.
            </p>
            <p className="text-gray-400 text-sm tracking-wide italic">
              화려하진 않지만, 여행길에서 천천히 쉬어가기에 충분합니다.
            </p>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section className="py-24 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-12 font-medium">
            Rooms · 객실
          </p>
          <div className="space-y-28">
            {rooms.map((room, idx) => (
              <div
                key={room.id}
                className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center ${
                  idx % 2 === 1 ? "md:grid-flow-dense" : ""
                }`}
              >
                {/* Images */}
                <div className={`${idx % 2 === 1 ? "md:col-start-2" : ""}`}>
                  <div className="grid grid-cols-2 gap-3">
                    {/* 방 사진 — 상단 와이드 */}
                    <div className="col-span-2 relative aspect-[16/9] rounded-2xl overflow-hidden">
                      <Image
                        src={room.roomImg}
                        alt={room.name}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                    {/* 공용 공간 사진 (있을 때만) */}
                    {room.commonImg && (
                      <div className="relative aspect-square rounded-xl overflow-hidden">
                        <Image
                          src={room.commonImg}
                          alt="공용 공간"
                          fill
                          className="object-cover hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    {/* 가격 타일 */}
                    <div className={`relative aspect-square rounded-xl overflow-hidden bg-[#faf9f7] flex items-center justify-center ${!room.commonImg ? "col-span-2" : ""}`}>
                      <div className="text-center">
                        <p className="text-4xl font-light text-[#372a14]">{room.price.toLocaleString()}</p>
                        <p className="text-xs text-gray-400 mt-1">원 / 박</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className={idx % 2 === 1 ? "md:col-start-1 md:row-start-1" : ""}>
                  <p className="text-[#296973] text-xs tracking-[0.2em] uppercase mb-3 font-medium">
                    {room.capacity}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-light text-[#372a14] mb-2">{room.name}</h2>
                  <p className="text-gray-400 text-sm mb-8">{room.en}</p>
                  <p className="text-gray-600 leading-relaxed mb-3">{room.desc}</p>
                  <p className="text-gray-400 text-sm leading-relaxed mb-8">{room.descEn}</p>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {room.features.map((f) => (
                      <span key={f} className="text-xs bg-[#faf9f7] border border-gray-200 text-gray-500 px-3 py-1.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                  <a
                    href="#booking"
                    className="inline-block bg-[#372a14] text-white text-sm font-medium px-8 py-3 rounded-full hover:bg-[#ff6b35] transition-colors"
                  >
                    이 방으로 예약 →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities — minimal */}
      <section className="py-16 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-10 font-medium">
            Amenities · 편의시설
          </p>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-6">
            {[
              { icon: "🍳", label: "공용 주방" },
              { icon: "🛋️", label: "살롱 거실" },
              { icon: "🚿", label: "샤워실" },
              { icon: "📶", label: "와이파이" },
              { icon: "❄️", label: "냉장고" },
              { icon: "☕", label: "커피/차" },
              { icon: "🌿", label: "조용한 환경" },
              { icon: "🏙️", label: "루프탑" },
              { icon: "🌀", label: "에어컨" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Space photos */}
      <section className="py-16 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-8 font-medium">
            공용 공간
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              "/images/stay/stay-sofa.jpg",
              "/images/stay/kitchen.jpg",
              "/images/stay/nagnae-1.jpg",
              "/images/about/guestbook-1.jpg",
              "/images/stay/stay-fridge.jpg",
              "/images/about/guestbook-2.jpg",
            ].map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                <Image
                  src={src}
                  alt={`공간 ${i + 1}`}
                  fill
                  className="object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 즐길거리 */}
      <section className="py-20 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-12 font-medium">
            Experiences · 즐길거리
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "🏪",
                title: "살롱앤스토어",
                desc: "1층에 위치한 코이노니아 살롱앤스토어를 라운지처럼 이용할 수 있습니다. 안동의 특산품도 만나보세요.",
                link: "/store",
                linkLabel: "스토어 보기 →",
              },
              {
                icon: "🍽️",
                title: "소셜 살롱 참여하기",
                desc: "수요 포틀럭, 프라이데이 나잇 등 다양한 살롱 프로그램이 열립니다. 안동의 로컬 피플과 어울려 보세요.",
                link: "/salon",
                linkLabel: "살롱 프로그램 →",
              },
              {
                icon: "🏛️",
                title: "안동 헤리티지 투어",
                desc: "봉정사와 하회마을, 병산서원과 낙동강을 천천히 둘러보는 세계문화유산 투어. 안동의 깊이를 경험하세요.",
                link: "/andong",
                linkLabel: "안동 가이드 →",
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-7">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="font-medium text-[#372a14] mb-3">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{item.desc}</p>
                <Link href={item.link} className="text-sm text-[#ff6b35] font-medium hover:underline">
                  {item.linkLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discount + check-in info */}
      <section className="py-16 px-6 md:px-16 bg-[#372a14] text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <p className="text-white/40 text-xs tracking-[0.2em] uppercase mb-4">체크인 / 체크아웃</p>
            <p className="text-lg font-light text-white mb-1">오후 3시 이후</p>
            <p className="text-lg font-light text-white mb-3">오전 11시 이전</p>
            <p className="text-white/40 text-xs">사전 협의 시 변경 가능</p>
          </div>
          <div>
            <p className="text-white/40 text-xs tracking-[0.2em] uppercase mb-4">할인 혜택</p>
            <div className="space-y-3">
              <div>
                <span className="text-[#ff6b35] font-light text-2xl">20%</span>
                <p className="text-white/70 text-sm mt-1">멤버십 &lsquo;곁&rsquo;</p>
              </div>
              <div>
                <span className="text-[#d0eef2] font-light text-2xl">30%</span>
                <p className="text-white/70 text-sm mt-1">서울 나그네방 후원자</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-white/40 text-xs tracking-[0.2em] uppercase mb-4">취소 정책</p>
            <div className="space-y-2 text-sm text-white/70">
              <p>7일 전 취소 — 전액 환불</p>
              <p>3–6일 전 취소 — 50% 환불</p>
              <p>2일 이내 취소 — 환불 불가</p>
            </div>
          </div>
        </div>
      </section>

      {/* Booking */}
      <section id="booking" className="py-24 px-6 md:px-16 bg-white scroll-mt-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-2">
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-6 font-medium">
              Reservation · 예약
            </p>
            <h2 className="text-2xl font-light text-[#372a14] mb-8">스테이 예약</h2>
            <div className="space-y-4 text-sm text-gray-500 leading-relaxed">
              <p>신청 즉시 예약이 확정됩니다.</p>
              <p>별도 안내 메시지 없이 약속한 날에 편히 방문해 주세요.</p>
              <p>문의: <a href="https://instagram.com/koinonia_andong" target="_blank" rel="noopener noreferrer" className="text-[#ff6b35]">@koinonia_andong</a></p>
            </div>
            <div className="mt-8 pt-8 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3">안동 여행도 함께 계획하세요</p>
              <Link href="/andong" className="text-sm text-[#296973] font-medium">
                안동 여행 가이드 →
              </Link>
            </div>
          </div>
          <div className="lg:col-span-3">
            <StayBookingForm />
          </div>
        </div>
      </section>
    </div>
  );
}
