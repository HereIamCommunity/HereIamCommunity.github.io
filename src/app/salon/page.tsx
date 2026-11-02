import Image from "next/image";
import SalonBookingForm from "@/components/SalonBookingForm";
import LightboxImage from "@/components/LightboxImage";

export const metadata = {
  title: "살롱 11월 프로그램 | 코이노니아",
  description: "생일파티, 제철과일, 종가음식, 연애담, 머더미스터리, 리딩클럽, 뮤직나잇까지. 코이노니아 11월 살롱 프로그램 신청.",
};

const potluckDates = [
  {
    date: "11월 4일 (수)",
    title: "11월 생일파티: 알베르 카뮈 생일파티 🎂",
    price: "10,000원",
    desc: "11월에 태어난 사람도, 카뮈를 좋아하는 사람도 함께! 좋아하는 음식과 이야기, 문장을 나눠요.",
  },
  {
    date: "11월 11일 (수)",
    title: "제철과일 포틀럭 🍎",
    price: "20,000원",
    desc: "함께 식사한 뒤, 지금 가장 맛있는 제철과일을 같이 먹고 그 과일에 대해 조금 더 알아가는 시간. 계절을 맛보고, 알게 된 이야기도 함께 나눠봅니다.",
  },
  {
    date: "11월 18일 · 11월 25일 (수)",
    title: "종가음식 포틀럭 🍽️",
    price: "무료",
    desc: "한국정신문화재단과 함께 안동의 종가문화와 종가음식을 알아보는 시간. 종가음식을 직접 맛보며 안동의 종가문화도 조금 더 가까이 만나봅니다.",
  },
];

const fridayDates = [
  {
    date: "11월 6일 (금)",
    title: "토크살롱: 연애담 💝",
    badge: "토크",
    price: "18,000원",
    desc: "연애 얘기, 어디까지 해봤나요? 설레었던 이야기부터 망한 이야기까지. 오늘만큼은 밤새 연애 얘기해도 됩니다.",
  },
  {
    date: "11월 13일 (금)",
    title: "보드게임 나잇: Murder Mystery 🔍",
    badge: "게임",
    price: "20,000원",
    desc: "우리 중에 범인이 있다. 먹고 떠들고 의심하며 즐기는 머더미스터리 나잇.",
  },
  {
    date: "11월 20일 (금)",
    title: "리딩클럽: 가을엔 읽고 쓰자 📖",
    badge: "리딩",
    price: "15,000원",
    desc: "같은 글을 함께 읽고 각자 마음에 남은 것을 짧게 써보는 시간.",
  },
  {
    date: "11월 27일 (금)",
    title: "뮤직 나잇: HOME MADE 🎵",
    badge: "음악",
    price: "20,000원",
    desc: "11월의 마지막 금요일, 음악과 사람으로 채우는 작은 홈메이드 나잇. 추워지는 늦가을 밤, 홈메이드의 소울 팝 함께 들어요!",
  },
];

const specialDates = [
  {
    date: "11월 10일 · 17일 · 24일 (화) 19:30",
    title: "화요 아뜰리에 🎨",
    desc: "다양한 재료로 나만의 작품을 만들어 보는 3주. 스텐실, 콜라주부터 다양한 텍스처까지. 함께 그리고 붙이며 조화를 발견하는 시간. 호스트: 성영 (Gloria) · 참가비 10,000원",
  },
  {
    date: "11월 21일 (토) 15:00",
    title: "아무튼 뜨개 살롱 🧶",
    desc: "날이 쌀쌀해졌으니 다시 실과 바늘을 꺼낼 때가 왔습니다. 한 코씩 천천히 뜨개를 하며 손을 움직이고 이야기를 나누는 오후. 호스트: 현정 (@sisol.made) · 참가비 10,000원",
  },
  {
    date: "11월 9일 · 23일 (월) 시간미정",
    title: "OPEN WORSHIP 🕯️",
    desc: "크리스천 주인장들이 은밀하게 드리던 월요 예배를 11월엔 격주로 오픈합니다. 신앙이 익숙한 사람도, 낯선 사람도 괜찮습니다. 부담 없이 찾아와 음악을 듣고 마음을 나누는 열린 자리. 참가비 무료",
  },
];

export default function SalonPage() {
  return (
    <div className="pt-14 md:pt-16 bg-[#faf9f7]">

      {/* ── 히어로 ── */}
      <section className="relative h-[55vh] min-h-[380px] flex items-end overflow-hidden">
        <Image
          src="/images/salon/living-4.jpg"
          alt="코이노니아 살롱"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="relative z-10 px-6 md:px-16 pb-12 max-w-6xl mx-auto w-full">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">Salon · 살롱</p>
          <h1 className="text-4xl md:text-6xl font-light text-white tracking-tight leading-none mb-3">
            코이노니아 살롱
          </h1>
          <p className="text-white/55 text-sm md:text-base max-w-md">
            경계 없이 열린 공간. 누구나 올 수 있는 모임의 자리.
          </p>
        </div>
      </section>

      {/* ── 11월 캘린더 ── */}
      <section id="calendar" className="py-12 px-6 md:px-16 bg-[#faf9f7] scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-6 font-medium">November Calendar · 11월 일정</p>
          <div className="relative w-full rounded-2xl overflow-hidden shadow-sm">
            <LightboxImage
              src="/images/salon/calendar-november.png"
              alt="코이노니아 11월 살롱 캘린더"
              width={900}
              height={700}
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* ── 수요 포틀럭 ── */}
      <section className="py-16 md:py-20 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start mb-12">
            <div>
              <p className="text-[#296973] text-xs tracking-[0.3em] uppercase mb-3 font-medium">Wednesday Potluck</p>
              <h2 className="text-3xl md:text-4xl font-light text-[#372a14] mb-4">수요 포틀럭</h2>
              <p className="text-gray-600 leading-relaxed mb-2">
                각자의 음식을 하나씩 가져와 함께 나누는 소셜 다이닝.
              </p>
              <p className="text-gray-400 text-sm mb-6">매주 수요일 19:00 시작</p>
              <div className="grid grid-cols-2 gap-2">
                <LightboxImage
                  src="/images/salon/potluck-poster-1-november.png"
                  alt="수요 포틀럭 11월 1"
                  width={200}
                  height={260}
                  className="w-full h-auto rounded-xl"
                />
                <LightboxImage
                  src="/images/salon/potluck-poster-2-november.png"
                  alt="수요 포틀럭 11월 2"
                  width={200}
                  height={260}
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-4 pt-0 md:pt-12">
              {potluckDates.map((item) => (
                <div key={item.date} className="border-l-2 border-[#296973]/30 pl-5 py-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-[#296973] font-semibold tracking-wide">{item.date}</p>
                    <span className="text-xs text-gray-400">{item.price}</span>
                  </div>
                  <p className="font-medium text-[#372a14] text-sm mb-1">{item.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <a
            href="#booking"
            className="inline-flex items-center gap-2 bg-[#296973] text-white text-sm font-semibold px-7 py-3 rounded-full hover:bg-[#1e5059] transition-colors"
          >
            수요 포틀럭 신청 →
          </a>
        </div>
      </section>

      {/* ── 프라이데이나잇 ── */}
      <section className="py-16 md:py-20 px-6 md:px-16 bg-[#372a14] text-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start mb-12">
            <div>
              <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-3 font-medium">Friday Night</p>
              <h2 className="text-3xl md:text-4xl font-light mb-4">프라이데이나잇</h2>
              <p className="text-white/60 leading-relaxed mb-2">
                한 주를 마무리하고 주말을 코이노니아에서 시작하는 금요일 밤.
              </p>
              <p className="text-white/40 text-sm mb-6">매주 금요일 20:00 시작</p>
              <div className="grid grid-cols-3 gap-2">
                <LightboxImage
                  src="/images/salon/friday-poster-1-november.png"
                  alt="프라이데이나잇 11월 1"
                  width={200}
                  height={260}
                  className="w-full h-auto rounded-xl"
                />
                <LightboxImage
                  src="/images/salon/friday-poster-2-november.png"
                  alt="프라이데이나잇 11월 2"
                  width={200}
                  height={260}
                  className="w-full h-auto rounded-xl"
                />
                <LightboxImage
                  src="/images/salon/friday-poster-3-november.png"
                  alt="프라이데이나잇 11월 3"
                  width={200}
                  height={260}
                  className="w-full h-auto rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-5 pt-0 md:pt-12">
              {fridayDates.map((item) => (
                <div key={item.date} className="border-l-2 border-[#ff6b35]/40 pl-5 py-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-[#ff6b35] font-semibold tracking-wide">{item.date}</p>
                    {item.badge && (
                      <span className="text-[10px] bg-[#ff6b35]/20 text-[#ff6b35] px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    <span className="text-[10px] text-white/30 ml-auto">{item.price}</span>
                  </div>
                  <p className="font-medium text-white text-sm mb-1">{item.title}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <a
            href="#booking"
            className="inline-flex items-center gap-2 bg-[#ff6b35] text-white text-sm font-semibold px-7 py-3 rounded-full hover:bg-[#e55a25] transition-colors"
          >
            프라이데이나잇 신청 →
          </a>
        </div>
      </section>

      {/* ── Someday Salons ── */}
      <section className="py-16 md:py-20 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-3 font-medium">Someday Salons</p>
              <h2 className="text-3xl md:text-4xl font-light text-[#372a14] mb-2">그 외 스페셜</h2>
              <p className="text-gray-400 text-sm mb-8">화·토·월요일에 열리는 소규모 특별 모임</p>
              <div className="space-y-4">
                {specialDates.map((item) => (
                  <div key={item.date} className="bg-white rounded-2xl p-6 border border-gray-100">
                    <p className="text-xs text-[#ff6b35] font-semibold tracking-wide mb-2">{item.date}</p>
                    <p className="font-medium text-[#372a14] text-sm mb-2">{item.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <LightboxImage
                src="/images/salon/booking-method-november.png"
                alt="신청 방법"
                width={400}
                height={500}
                className="w-full max-w-sm h-auto rounded-2xl shadow-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 신청 폼 ── */}
      <section id="booking" className="py-16 md:py-20 px-6 md:px-16 bg-white scroll-mt-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-2">
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-5 font-medium">How to Join · 참가 안내</p>
            <h2 className="text-2xl font-light text-[#372a14] mb-8">신청 방법</h2>
            <div className="space-y-5 text-sm">
              {[
                { step: "01", title: "프로그램 선택", desc: "참가하고 싶은 날짜와 프로그램을 고르세요." },
                { step: "02", title: "정보 입력", desc: "이름과 연락처를 입력하고 신청을 완료하세요." },
                { step: "03", title: "계좌이체", desc: "표시된 계좌로 참가비를 입금하세요." },
              ].map((s) => (
                <div key={s.step} className="flex gap-4">
                  <span className="text-[#ff6b35] font-bold text-xs pt-0.5 shrink-0">{s.step}</span>
                  <div>
                    <p className="font-medium text-[#372a14] mb-0.5">{s.title}</p>
                    <p className="text-gray-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-8 border-t border-gray-200 space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">계좌이체</p>
                <p className="text-sm font-semibold text-[#296973]">하나은행 5539-10-13844507</p>
                <p className="text-xs text-gray-400">예금주: 코이노니아</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">문의</p>
                <a
                  href="https://instagram.com/koinonia_andong"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#ff6b35] font-medium"
                >
                  @koinonia_andong →
                </a>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <SalonBookingForm />
          </div>
        </div>
      </section>

    </div>
  );
}
