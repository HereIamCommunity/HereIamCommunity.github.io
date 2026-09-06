import Image from "next/image";
import SalonBookingForm from "@/components/SalonBookingForm";
import LightboxImage from "@/components/LightboxImage";

export const metadata = {
  title: "살롱 9월 프로그램 | 코이노니아",
  description: "무비나잇, 개강파티, 보드게임, 추석포틀럭, 탈춤축제까지. 코이노니아 9월 살롱 프로그램 신청.",
};

const potluckDates = [
  {
    date: "9월 2일 (수)",
    title: "9월 생일자 파티 🎂",
    price: "10,000원",
    desc: "9월생들 모여라! 이달의 작가 '톨스토이'. 생일인 사람도 아닌 사람도 함께 먹고 축하하는 저녁.",
  },
  {
    date: "9월 9일 (수)",
    title: "수요포틀럭 🍽️",
    price: "10,000원",
    desc: "",
  },
  {
    date: "9월 16일 (수)",
    title: "제철 과일 클럽 🍇",
    price: "20,000원",
    desc: "식사와 함께 제철 과일을 맛보고, 먹고, 이야기하며 노는 즉흥 과일 클럽. 코이노니아에서 햇밀로 만든 빵과 다품종 포도를 준비할게요.",
  },
  {
    date: "9월 23일 (수)",
    title: "추석포틀럭: 명절오락관 🌕",
    price: "10,000원",
    desc: "명절 음식 한 상 차리고, 윷놀이부터 각종 오락까지—코이노니아식 추석 전야제.",
  },
  {
    date: "9월 30일 (수)",
    title: "탈춤포틀럭 💃",
    price: "10,000원",
    desc: "축제 한복판에서 맞는 수요일, 먹고 마시고 탈춤판까지 함께 갑시다.",
  },
];

const fridayDates = [
  {
    date: "9월 4일 (금)",
    title: "무비나잇 🎬",
    badge: "영화",
    price: "20,000원",
    desc: "금요일 밤, 술 한잔과 함께 영화 한 편 보고 실컷 이야기합니다.",
  },
  {
    date: "9월 11일 (금)",
    title: "개강파티 🎒",
    badge: "파티",
    price: "20,000원",
    desc: "개강했으니 축하해야죠(?) 새 학기의 피로를 핑계 삼아 같이 한잔하는 밤.",
  },
  {
    date: "9월 18일 (금)",
    title: "보드게임나잇 🎲",
    badge: "게임",
    price: "20,000원",
    desc: "친해지는 데 게임만 한 게 없으니까. 처음 본 사람과도 한 판 붙어봅니다.",
  },
];

const specialDates = [
  {
    date: "9월 12일 (토)",
    title: "드렁큰 낭독회 📖",
    desc: "술 한 잔 곁에 두고, 각자 좋아하는 문장을 소리 내어 읽는 밤. 10,000원",
  },
  {
    date: "9월 15일 · 22일 · 29일 (월)",
    title: "아이, 마이, 미, 마인 🎭",
    desc: "나만의 1인극 만들기 프로젝트. 신청 시 5회차 전체 참가. 무료 참가. — 세부 내용은 8/31(월) 저녁 공개 예정.",
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

      {/* ── 8월 소개 문구 ── */}
      <section className="py-16 md:py-20 px-6 md:px-16 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-5 font-medium">September 2026 · 9월</p>
            <h2 className="text-3xl md:text-4xl font-light text-[#372a14] leading-tight">
              여름이 지나도,<br />
              코이노니아의 밤은<br />
              끝나지 않아요.
            </h2>
          </div>
          <div className="pt-0 md:pt-10">
            <p className="text-gray-600 leading-relaxed text-base mb-5">
              같이 밥 먹고, 영화 보고, 책 읽고, 게임하다가 월말에는 탈춤축제까지. 9월도 같이 놀아요!
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              코이노니아 9월 캘린더 오픈합니다 ♥
            </p>
            <div className="mt-8 flex gap-3">
              <a
                href="#booking"
                className="bg-[#ff6b35] text-white text-sm font-semibold px-6 py-3 rounded-full hover:bg-[#e55a25] transition-colors"
              >
                바로 신청하기
              </a>
              <a
                href="#calendar"
                className="border border-gray-200 text-gray-600 text-sm font-medium px-6 py-3 rounded-full hover:border-gray-400 transition-colors"
              >
                캘린더 보기
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8월 캘린더 ── */}
      <section id="calendar" className="py-12 px-6 md:px-16 bg-[#faf9f7] scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-6 font-medium">September Calendar · 9월 일정</p>
          <div className="relative w-full rounded-2xl overflow-hidden shadow-sm">
            <LightboxImage
              src="/images/salon/calendar-september.png"
              alt="코이노니아 9월 살롱 캘린더"
              width={900}
              height={700}
              className="w-full h-auto"
            />
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">
            * Someday Salons (드렁큰 낭독회, 아이·마이·미·마인)은 별도 안내 예정
          </p>
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
              <div className="inline-block relative rounded-xl overflow-hidden">
                <LightboxImage
                  src="/images/salon/potluck-poster-september.png"
                  alt="수요 포틀럭 9월"
                  width={340}
                  height={420}
                  className="w-full max-w-[300px] h-auto rounded-xl"
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
              <div className="grid grid-cols-2 gap-2">
                <LightboxImage
                  src="/images/salon/friday-poster-1-september.png"
                  alt="프라이데이나잇 1-2주차"
                  width={200}
                  height={260}
                  className="w-full h-auto rounded-xl"
                />
                <LightboxImage
                  src="/images/salon/friday-poster-2-september.png"
                  alt="프라이데이나잇 3주차"
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
              <p className="text-gray-400 text-sm mb-8">화·목요일에 열리는 소규모 특별 모임 · 20:00 시작 · 10,000원</p>
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
                src="/images/salon/special-september.png"
                alt="9월 스페셜 살롱"
                width={400}
                height={500}
                className="w-full max-w-sm h-auto rounded-2xl shadow-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 결제 안내 배너 ── */}
      <section className="py-10 px-6 md:px-16 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-2 font-medium">Payment</p>
            <p className="text-[#372a14] font-medium">계좌이체로 결제 · 카드결제 준비 중</p>
            <p className="text-gray-400 text-sm mt-1">신청 즉시 참가가 확정됩니다. 별도 안내 없이 약속한 시간에 편히 방문해 주세요.</p>
          </div>
          <div className="text-sm text-gray-500 space-y-1">
            <p>하나은행 <span className="font-semibold text-[#296973]">5539-10-13844507</span></p>
            <p>예금주: 코이노니아</p>
          </div>
        </div>
      </section>

      {/* ── 신청 폼 ── */}
      <section id="booking" className="py-16 md:py-20 px-6 md:px-16 bg-[#faf9f7] scroll-mt-16">
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
            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-xs text-gray-400 mb-2">문의</p>
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
          <div className="lg:col-span-3">
            <SalonBookingForm />
          </div>
        </div>
      </section>

    </div>
  );
}
