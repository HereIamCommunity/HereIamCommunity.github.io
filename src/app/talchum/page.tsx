import SalonBookingForm, { type ProgramGroup } from "@/components/SalonBookingForm";
import TalchumProgramGrid, { type ProgramCard } from "@/components/TalchumProgramGrid";
import LightboxImage from "@/components/LightboxImage";
import { TALCHUM_PROGRAMS } from "@/lib/programs";

export const metadata = {
  title: "안동탈춤축제 코이노니아와 함께 즐겨요 | 코이노니아",
  description:
    "2026 안동국제탈춤페스티벌(9/24–10/4) 기간, 코이노니아에서 여는 포틀럭 파티·무비올나잇·DJ 레이브·탈춤런·컨택 잼 워크숍·명상 & 샌드아트 등 프로그램 신청.",
};

const TALCHUM_GROUPS: ProgramGroup[] = [
  {
    type: "talchum",
    label: "Festival Program",
    labelClass: "text-[#ff6b35]",
    priceClass: "text-[#ff6b35]",
  },
  {
    type: "talchum-open",
    label: "Everyday · 상시",
    labelClass: "text-[#296973]",
    priceClass: "text-[#296973]",
  },
];

/**
 * 인문트럭 신청은 주최기관이 따로 운영하는 폼으로 받는다
 * (성함·이메일·연락처·연령대·신청 이유 등).
 */
const INMUN_TRUCK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfb63wgNDTJRgxubc3vBW_dLYnkRVlAZzQF-s6ESEIROUzuuw/viewform";

/* ── 프로그램 소개 — 문구는 카드뉴스 원문 그대로 ────────────── */
const CARDS: ProgramCard[] = [
  {
    imgs: ["inmun-truck-1.jpg", "inmun-truck-2.jpg"],
    title: "청년인문교실 「안동인문행복트럭」",
    when: "9.24 (목)",
    whenFull: "9.24 (목) 1:00 - 3:00 pm",
    price: "무료",
    priceNote:
      "참가비 무료 · 안동 청년 코어 참여자 15명 모집 · 문화체육관광부 주최 / 한국정신문화재단 협력",
    body: "청년인문교실은 다양한 인문 콘텐츠를 통해 나를 돌아보고, 타인과 연결되며, 일상 속에서 인문적 사유를 실천하는 프로그램입니다.\n\n안동의 사람을 만나고, 도시를 걷고, 축제를 경험하고, 100개의 질문에 답하며 나의 삶과 지역을 다시 바라봅니다. 정답을 배우는 수업이 아니라 나만의 질문을 발견하는 시간.",
    note: "원도심 → 탈춤축제 → 도산·병산서원 → 인문가치포럼 · 코이노니아에서는 9월 24일 회차가 열립니다.",
    badge: "주최기관 신청폼",
    externalForm: { url: INMUN_TRUCK_FORM_URL, label: "참여자 신청하기" },
  },
  {
    imgs: ["potluck.png"],
    title: "포틀럭 파티",
    when: "9.26 · 27 · 30, 10.1 · 2",
    whenFull: "9.26 (토) · 9.27 (일) · 9.30 (수) · 10.1 (목) · 10.2 (금) 7:00 - 8:30 pm",
    price: "10,000원",
    priceNote: "참가비 10,000원",
    body: "축제에 혼자 온 사람도, 가족과 온 사람도,\n외국 여행객 모두 참여할 수 있는\n코이노니아 시그니처 살롱.\n1인분의 음식을 가지고 둘러앉아\n음식과 이야기를 나눕니다.\n우리가 서로를 알아갈 수 있다는 게\n얼마나 큰 우연이고 행운인지!",
    note: "준비물 : 각자 1인분 음식",
  },
  {
    imgs: ["talk.png"],
    title: "스치는 대화",
    when: "축제기간 상시",
    whenFull: "축제 기간 상시 2:00 - 6:00 pm",
    price: "5,000원",
    priceNote: "예약 : 5,000원 (음료 제공) / 워크인 : 음료 주문 필수",
    body: "축제 한가운데 원래라면 스쳐 지나갔을\n사람과 잠시 마주 앉습니다.\n이름도 직업도 묻지 않고 요즘 좋아하는 것,\n최근의 마음, 살아가는 이야기를 나눠요.\n스쳐가는 사람과 잠깐 '사이'가 되어보세요.",
    note: "30분 단위로 2명씩 신청받습니다.",
    badge: "상시",
  },
  {
    imgs: ["movie.png"],
    title: "무비올나잇",
    when: "9.25 (금)",
    whenFull: "9.25 (금) 9 pm - 3 am",
    price: "20,000원",
    priceNote: "참가비 20,000원",
    body: "고향에 내려온 타지 사람들을 위한 이벤트!\n명절 내내 집에서 늘어져 있어 나가고 싶다면!\n코이노니아에서 분위기 좋은 영화 틀어놓고\n와인 마시며 옆사람과 필담을 나눠요!",
  },
  {
    imgs: ["dj.png"],
    title: "DJ 레이브",
    when: "10.1 (목)",
    whenFull: "10.1 (목) 8:00 - 10:00 pm",
    price: "5,000원",
    priceNote: "예약 : 5,000원 (음료 제공) / 워크인 : 음료 주문 필수",
    body: "탈춤 축제에서 춤이 빠질 수 없어서 만든 이벤트\nDJ 레이브에 맞춰 춤추자!\n\n음악이 나오면 몸이 저절로 움직이는\n안동 최연소 DJ 보다와 함께 합니다.",
    note: "DJ 라인업 — 보다 · 신의 뜻",
  },
  {
    imgs: ["run.png"],
    title: "탈춤런",
    when: "9.27 (일)",
    whenFull: "9.27 (일) 9:00 - 10:00 pm",
    price: "10,000원",
    priceNote: "참가비 10,000원",
    body: "추석에 과식한 사람들 모이세요.\n경보부터 10km 런까지 각 그룹의\n페이스에 맞춰 죄책감 털기런을 진행합니다.\n탈춤 축제 기간이니,\n축제장도 한 바퀴 돌아볼까요?",
    note: "with 하영",
  },
  {
    imgs: ["contact-jam.png"],
    title: "컨택 잼 워크숍",
    when: "9.28 (월)",
    whenFull: "9.28 (월) 7:30 - 9:00 pm",
    price: "30,000원",
    priceNote: "참가비 30,000원",
    body: "몸과 몸의 부딪힘 속에서 자연스럽게\n연결되는 춤사위를 경험합니다.\n몸의 안과 밖에서 이미 추어지고 있는 춤을\n발견하는 여러 방식을 경험함으로써\n나만의 고유한 몸표현, 음악성을\n경험하게 됩니다.",
    note: "with 바리 / 준비물 : 편안한 복장",
  },
  {
    imgs: ["dance.png"],
    title: "즉흥 댄스 공연",
    when: "9.28 (월)",
    whenFull: "9.28 (월) 3:00 pm",
    price: "무료 입장, 유료 퇴장",
    body: "댄서 김바리, 트럼펫 연주 장보석.",
    badge: "워크인",
  },
  {
    imgs: ["meditation.png"],
    title: "명상 & 샌드아트",
    when: "9.26 · 10.3 (토)",
    whenFull: "9.26 / 10.3 (토) 8:00 - 9:30 am",
    price: "20,000원",
    priceNote: "참가비 20,000원",
    body: "자연의 소리를 담은 명상 악기와\n손가락 사이로 빠져나가는 샌드 아트를\n활용해 명상 워크샵을 진행합니다.\n둥글게 둘러 앉아 소리와 공명하고,\n샌드만다라를 함께 그리고 지웁니다.",
    note: "with 재철",
  },
  {
    imgs: ["mask.png"],
    title: "탈꾸미기 & 족자 쓰기",
    when: "축제기간 상시",
    whenFull: "축제기간 상시 2:00 - 6:00 pm",
    price: "5,000원",
    priceNote: "참가비 5,000원",
    body: "핸드메이드 하회탈 만들기.\n하얀 캔버스같은 탈 위에\n알록달록 나만의 취향과 색을 입혀요.",
    badge: "워크인",
  },
  {
    imgs: ["caricature.png"],
    title: "캐리커쳐",
    when: "축제기간 상시",
    whenFull: "축제기간 상시 2:00 - 6:00 pm",
    price: "5,000원",
    priceNote: "참가비 5,000원",
    body: "탈춤축제에서 만난 오늘의 얼굴을\n그림 한 장으로 남겨드립니다.\n잠시 자리에 앉으면 코이노니아의 호스트가\n당신의 모습을 바라보고 그려드려요.\n그림이 완성되는 몇 분 동안 자연스럽게\n이야기도 나누고, 축제에서의 모습을\n작은 기록으로 가져갑니다.",
    badge: "워크인",
  },
  {
    imgs: ["bar.png"],
    title: "코이노니아 바",
    when: "축제기간 상시",
    whenFull: "축제기간 상시 9 pm - 2 am",
    price: "신청 없이 방문",
    body: "낯선 사람과 자연스럽게 인사를 나누고\n축제의 여운을 함께 즐길 수 있는\n기간 한정 커뮤니티 바",
    note: "* 식음 라인업은 곧 공개됩니다",
    badge: "워크인",
  },
];

export default function TalchumPage() {
  return (
    <div className="pt-14 md:pt-16 bg-[#faf9f7]">

      {/* ── 히어로 ── */}
      <section className="bg-[#f0efe6] px-6 md:px-16 py-14 md:py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-4 font-medium">
              Andong Maskdance Festival · 2026.09.24 – 10.04
            </p>
            <h1 className="text-3xl md:text-5xl font-light text-[#9e2540] tracking-tight leading-tight mb-5">
              우리 같이<br />
              안동국제탈춤페스티벌<br />
              즐겨요!
            </h1>
            <p className="text-[#372a14]/60 text-sm leading-relaxed mb-8 max-w-sm">
              축제 기간 동안 코이노니아에서 즐기는 법. 포틀럭부터 무비올나잇, DJ 레이브,
              탈춤런, 컨택 잼, 명상까지 열두 가지 프로그램을 준비했어요.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#booking"
                className="bg-[#ff6b35] text-white text-sm font-semibold px-6 py-3 rounded-full hover:bg-[#e55a25] transition-colors"
              >
                바로 신청하기
              </a>
              <a
                href="#programs"
                className="border border-[#372a14]/15 text-[#372a14]/70 text-sm font-medium px-6 py-3 rounded-full hover:border-[#372a14]/40 transition-colors"
              >
                프로그램 보기
              </a>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <LightboxImage
              src="/images/talchum/cover.png"
              alt="우리 같이 안동국제탈춤페스티벌 즐겨요"
              width={540}
              height={675}
              className="w-full max-w-sm h-auto rounded-2xl shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* ── 코이노니아 소개 (처음 오는 사람을 위해) ── */}
      <section className="bg-[#372a14] px-6 md:px-16 py-10 md:py-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-3 font-medium">코이노니아가 뭔데?</p>
            <p className="text-white text-base md:text-lg font-light leading-relaxed max-w-xl">
              안동 구도심에 있는 문화 공간이에요. 살롱 모임, 게스트하우스, 스토어를 운영하며
              일, 놀이, 쉼을 함께 만들어가는 곳입니다. 밥도 먹고 술도 마시고 게임도 하고 공연도 봐요.
              낯선 사람이 앉아도 어색하지 않은 자리를 만들어왔어요.
            </p>
          </div>
          <a
            href="/about"
            className="shrink-0 text-white/50 text-sm hover:text-[#ff6b35] transition-colors flex items-center gap-2"
          >
            더 알아보기 →
          </a>
        </div>
      </section>

      {/* ── 프로그램 ── */}
      <section id="programs" className="py-16 md:py-20 px-6 md:px-16 bg-white scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <p className="text-[#296973] text-xs tracking-[0.3em] uppercase mb-3 font-medium">
            Programs · 프로그램
          </p>
          <h2 className="text-3xl md:text-4xl font-light text-[#372a14] mb-3">
            축제 기간 동안<br className="md:hidden" /> 코이노니아에서 즐기는 법
          </h2>
          <p className="text-sm text-gray-400 mb-10">
            카드를 누르면 자세한 내용을 볼 수 있어요.
          </p>

          <TalchumProgramGrid cards={CARDS} />

          {/* ── 워크인 안내 ── */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#faf9f7] border border-[#e8e5df] rounded-2xl px-7 py-6">
              <p className="text-[#296973] text-xs font-semibold tracking-wide uppercase mb-3">
                신청 없이 오시면 되는 프로그램
              </p>
              <p className="text-[#372a14] text-sm leading-relaxed mb-1">
                <span className="font-medium">탈꾸미기 &amp; 족자 쓰기 · 캐리커쳐 · 코이노니아 바 · 즉흥 댄스 공연</span>
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                워크인으로 운영합니다. 편한 시간에 들러주세요.
              </p>
            </div>
            <div className="bg-[#faf9f7] border border-[#e8e5df] rounded-2xl px-7 py-6">
              <p className="text-[#ff6b35] text-xs font-semibold tracking-wide uppercase mb-3">
                별도 신청폼으로 접수
              </p>
              <p className="text-[#372a14] text-sm leading-relaxed mb-1">
                <span className="font-medium">청년인문교실 「안동인문행복트럭」</span>
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                주최기관(문화체육관광부 · 한국정신문화재단) 신청폼으로 접수합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 코이노니아 메시지 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-[#372a14] text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-10 font-medium">
            우리가 이 모든 걸 준비한 이유
          </p>
          <div className="text-white/80 text-base md:text-lg font-light leading-[2] space-y-6 text-left md:text-center">
            <p>
              서로 사랑하는 세상이 있었대<br />
              거기선 둘러 앉아 함께 밥을 먹는대<br />
              배고픈 사람의 그릇에는<br />
              어느새 빵이 하나 더 놓이고<br />
              외로운 사람 곁에는<br />
              함께 앉아주는 자리가 생긴대
            </p>
            <p>
              늑대와 어린양이 함께 놀듯<br />
              서로 달라 두려웠던 이들도<br />
              천천히 각자의 이야기를 들었대<br />
              작은 목소리도 바람에 흩어지지 않았대
            </p>
            <p>
              그렇게 웃고 울고 격려하고<br />
              보살피는 식사가 끝나면<br />
              아무도 내일이 걱정되지 않았대
            </p>
          </div>
          <p className="mt-12 text-white text-xl md:text-2xl font-light tracking-wide">
            어때? 우리 같이 가볼래?
          </p>
          <a
            href="#booking"
            className="mt-8 inline-block bg-[#ff6b35] text-white text-sm font-semibold px-8 py-3.5 rounded-full hover:bg-[#e55a25] transition-colors"
          >
            프로그램 신청하기
          </a>
        </div>
      </section>

      {/* ── 일정표 ── */}
      <section id="calendar" className="py-14 md:py-16 px-6 md:px-16 bg-[#faf9f7] scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-6 font-medium">
            Schedule · 축제기간 프로그램 일정
          </p>
          <div className="relative w-full rounded-2xl overflow-hidden shadow-sm">
            <LightboxImage
              src="/images/talchum/calendar.png"
              alt="2026 안동국제탈춤페스티벌 코이노니아 프로그램 일정표"
              width={900}
              height={1125}
              className="w-full h-auto"
            />
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">
            * 9월 29일 (화)은 휴무입니다.
          </p>
        </div>
      </section>

      {/* ── 결제 안내 배너 ── */}
      <section className="py-10 px-6 md:px-16 bg-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-2 font-medium">Payment</p>
            <p className="text-[#372a14] font-medium">계좌이체로 결제 · 카드결제 준비 중</p>
            <p className="text-gray-400 text-sm mt-1">
              신청 즉시 참가가 확정됩니다. 별도 안내 없이 약속한 시간에 편히 방문해 주세요.
            </p>
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
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-5 font-medium">
              How to Join · 참가 안내
            </p>
            <h2 className="text-2xl font-light text-[#372a14] mb-8">신청 방법</h2>
            <div className="space-y-5 text-sm">
              {[
                { step: "01", title: "날짜 선택", desc: "달력에서 방문할 날짜를 고르세요." },
                { step: "02", title: "프로그램 선택", desc: "그 날 열리는 프로그램 중에서 고릅니다." },
                { step: "03", title: "정보 입력", desc: "이름과 연락처를 입력하고 신청을 완료하세요." },
                { step: "04", title: "계좌이체", desc: "표시된 계좌로 참가비를 입금하세요." },
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

            <div className="mt-8 rounded-xl bg-white border border-gray-100 p-5">
              <p className="text-xs font-semibold text-[#296973] mb-2">신청 없이 오시면 되는 프로그램</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                탈꾸미기 &amp; 족자 쓰기, 캐리커쳐, 코이노니아 바, 즉흥 댄스 공연은
                워크인으로 운영합니다. 편한 시간에 들러주세요.
              </p>
              <p className="text-xs text-gray-500 leading-relaxed mt-2">
                청년인문교실 「안동인문행복트럭」은 주최기관 신청폼으로 접수합니다.
              </p>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-xs text-gray-400 mb-2">위치</p>
              <p className="text-sm text-[#372a14]">안동시 중앙로 57 코이노니아 <span className="text-gray-400">(구 마산해장국)</span></p>
            </div>
            <div className="mt-6">
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
            <SalonBookingForm
              mode="calendar"
              programs={TALCHUM_PROGRAMS}
              groups={TALCHUM_GROUPS}
              heading="탈춤축제 프로그램 신청"
              description="달력에서 날짜를 고르면 그 날 열리는 프로그램이 나옵니다."
            />
          </div>
        </div>
      </section>

    </div>
  );
}
