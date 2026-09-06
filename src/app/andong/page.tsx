import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "안동 여행 가이드 | 코이노니아",
  description: "안동에서 꼭 가봐야 할 곳, 먹어야 할 것. 코이노니아가 추천하는 안동 여행 가이드.",
};

export default function AndongPage() {
  return (
    <div className="pt-14 md:pt-16">
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[400px] flex items-end overflow-hidden">
        <Image
          src="/images/about/andong-house.jpg"
          alt="안동"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="relative z-10 px-6 md:px-16 pb-14 max-w-6xl mx-auto w-full">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-4 font-medium">Andong Guide · 안동 가이드</p>
          <h1 className="text-4xl md:text-6xl font-light text-white tracking-tight mb-4">안동 여행 가이드</h1>
          <p className="text-white/60 text-base max-w-md">안동은 느리게 흘러갑니다. 살방살방 편히 오세요.</p>
        </div>
      </section>

      {/* Intro */}
      <section className="py-20 px-6 md:px-16 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-6 font-medium">Why Andong</p>
            <h2 className="text-3xl md:text-4xl font-light text-[#372a14] leading-tight">
              한국 유교 문화의 고장,<br />정신문화의 수도
            </h2>
          </div>
          <div className="pt-0 md:pt-12">
            <p className="text-gray-600 leading-relaxed mb-4">
              안동은 고즈넉한 한국의 정경을 둘러볼 수 있는 지역입니다.
              세계문화유산으로 지정된 <strong className="text-[#372a14]">하회마을</strong>과 <strong className="text-[#372a14]">봉정사</strong>는 물론,
              퇴계 이황 선생의 정신이 살아 있는 <strong className="text-[#372a14]">도산서원</strong>,
              그리고 <strong className="text-[#372a14]">이육사 문학관</strong> 등을 둘러볼 수 있습니다.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              낙동강 상류의 아름다운 풍류를 즐기며 산책할 수 있는
              월영교와 안동댐 산책 코스도 빼놓을 수 없어요.
            </p>
          </div>
        </div>
      </section>

      {/* Getting there */}
      <section className="py-16 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-6 font-medium">Getting Here · 오시는 길</p>
          <h2 className="text-2xl font-light text-[#372a14] mb-8">오시는 방법</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🚄",
                title: "기차 (KTX/ITX)",
                lines: [
                  "서울 → 안동역 (ITX-새마을 약 3시간)",
                  "부산 → 안동역 (무궁화호 약 2시간 30분)",
                  "코이노니아까지 택시 약 20분 (1만 원)",
                ],
              },
              {
                icon: "🚌",
                title: "버스",
                lines: [
                  "서울 동서울터미널 → 안동 약 2시간 50분",
                  "부산 → 안동 약 2시간",
                  "안동터미널에서 택시 이용",
                ],
              },
              {
                icon: "🚗",
                title: "자가용",
                lines: [
                  "서울에서 약 2시간 30분 (중앙고속도로)",
                  "부산에서 약 1시간 30분",
                  "인근 웅부공영주차장 이용 (도보 1분)",
                ],
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-6">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-[#372a14] mb-3">{item.title}</h3>
                <ul className="space-y-2">
                  {item.lines.map((line) => (
                    <li key={line} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-[#ff6b35] mt-0.5 flex-shrink-0">·</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Must-see */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-sm font-semibold tracking-widest uppercase mb-3">Sightseeing</p>
          <h2 className="text-2xl font-bold text-[#372a14] mb-8">꼭 가봐야 할 곳</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                name: "하회마을",
                category: "유네스코 세계문화유산",
                desc: "낙동강이 굽어 도는 마을. 조선시대 양반 문화가 살아있는 곳. 탈춤 공연, 전통 가옥, 강변 산책이 인상적입니다.",
                tip: "아침 일찍 가면 관광객이 적어 여유롭게 둘러볼 수 있어요.",
                time: "코이노니아에서 차로 약 20분",
              },
              {
                name: "도산서원",
                category: "사적지",
                desc: "퇴계 이황 선생이 세운 서원. 조용하고 아름다운 산속에 자리잡아 사색하기 좋습니다. 가을 단풍이 특히 아름다워요.",
                tip: "서원 뒤편 언덕에서 보는 풍경을 놓치지 마세요.",
                time: "코이노니아에서 차로 약 35분",
              },
              {
                name: "안동 민속박물관",
                category: "박물관",
                desc: "안동의 민속 문화와 생활사를 담은 박물관. 안동 탈춤, 차전놀이 등 무형문화재와 전통 생활 유물을 볼 수 있습니다.",
                tip: "박물관 옆 민속촌과 함께 둘러보세요.",
                time: "코이노니아에서 차로 약 15분",
              },
              {
                name: "월영교",
                category: "명소",
                desc: "안동호 위에 놓인 국내 최장 목책 인도교. 낮에는 호수와 산의 풍경이, 밤에는 조명이 켜진 야경이 아름다운 안동의 대표 명소입니다.",
                tip: "해질 무렵이나 야간에 방문하면 특히 멋있어요.",
                time: "코이노니아에서 차로 약 10분",
              },
            ].map((place) => (
              <div key={place.name} className="border border-gray-100 rounded-xl p-6 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs bg-[#ff6b35]/10 text-[#ff6b35] px-2 py-0.5 rounded-full font-medium">
                      {place.category}
                    </span>
                    <h3 className="text-lg font-bold text-[#372a14] mt-2">{place.name}</h3>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{place.desc}</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-[#296973] font-medium flex-shrink-0">TIP</span>
                    <span className="text-gray-500">{place.tip}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-[#296973] font-medium flex-shrink-0">위치</span>
                    <span className="text-gray-500">{place.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Heritage Tour */}
      <section className="py-16 px-6 bg-[#faf9f7]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-sm font-semibold tracking-widest uppercase mb-3">Heritage Tour</p>
          <h2 className="text-2xl font-bold text-[#372a14] mb-2">코이노니아 헤리티지 투어</h2>
          <p className="text-gray-500 text-sm mb-10">뚜벅이로 가기 어려운 안동의 지역 명소들을 SUV 차량과 가이드와 함께 둘러봅니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* 코스 1 */}
            <div className="bg-white rounded-2xl p-7 border border-gray-100">
              <p className="text-xs text-[#ff6b35] font-semibold tracking-widest uppercase mb-1">Course 1</p>
              <h3 className="text-xl font-bold text-[#372a14] mb-1">서애의 땅</h3>
              <p className="text-sm text-gray-400 mb-5">안동 서쪽의 유교 문화를 따라</p>
              <ol className="space-y-3">
                {["봉정사", "병산서원", "하회마을"].map((spot, i) => (
                  <li key={spot} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-6 h-6 rounded-full bg-[#ff6b35]/10 text-[#ff6b35] text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    {spot}
                  </li>
                ))}
              </ol>
            </div>
            {/* 코스 2 */}
            <div className="bg-white rounded-2xl p-7 border border-gray-100">
              <p className="text-xs text-[#296973] font-semibold tracking-widest uppercase mb-1">Course 2</p>
              <h3 className="text-xl font-bold text-[#372a14] mb-1">퇴계의 길</h3>
              <p className="text-sm text-gray-400 mb-5">안동 동북쪽의 선비 정신을 따라</p>
              <ol className="space-y-3">
                {["도산서원", "이육사 문학관", "농암종택 또는 맹개마을"].map((spot, i) => (
                  <li key={spot} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-6 h-6 rounded-full bg-[#296973]/10 text-[#296973] text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    {spot}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          {/* 참가비 안내 */}
          <div className="bg-[#372a14] text-white rounded-2xl px-7 py-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-10">
            <div>
              <p className="text-white/40 text-xs tracking-widest uppercase mb-1">참가비</p>
              <p className="text-2xl font-light">1인 <strong className="text-[#ff6b35]">80,000원</strong></p>
            </div>
            <div className="w-px h-10 bg-white/10 hidden md:block" />
            <div className="text-sm text-white/60 leading-relaxed">
              <p>최소 2인 · 최대 4인 동행</p>
              <p>SUV 차량 이동 및 가이드 제공</p>
            </div>
          </div>
        </div>
      </section>

      {/* Food */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-sm font-semibold tracking-widest uppercase mb-3">Food &amp; Cafe</p>
          <h2 className="text-2xl font-bold text-[#372a14] mb-8">추천 식당 &amp; 카페</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: "산청식당", desc: "간고등어 정식", dist: "도보 15분 · 자차 5분", tag: "식당" },
              { name: "황토방묵집", desc: "손국수 · 메밀묵밥", dist: "자차 15분", tag: "식당" },
              { name: "현대찜닭", desc: "안동 찜닭 골목", dist: "도보 10분", tag: "식당" },
              { name: "효자통닭", desc: "옛날식 통닭", dist: "도보 10분", tag: "식당" },
              { name: "옥동손국수", desc: "안동국시 · 메밀묵밥 · 파전", dist: "자차 10분", tag: "식당" },
              { name: "뉴서울갈비", desc: "갈비골목 대표 맛집", dist: "도보 5분", tag: "식당" },
              { name: "옥야식당", desc: "경상도식 국밥", dist: "자차 10분", tag: "식당" },
              { name: "우성식육식당", desc: "차돌박이 · 꽃대패삼겹", dist: "자차 10분", tag: "식당" },
              { name: "아차가", desc: "젤라또", dist: "도보 5분", tag: "카페·디저트" },
              { name: "상지떡볶이튀김", desc: "분식", dist: "도보 10분", tag: "카페·디저트" },
              { name: "말콥버거", desc: "수제버거", dist: "도보 5분", tag: "카페·디저트" },
              { name: "카페올유", desc: "카페", dist: "도보 10분 · 자차 5분", tag: "카페·디저트" },
              { name: "396커피스토어", desc: "카페", dist: "도보 10분", tag: "카페·디저트" },
              { name: "얼렌드커피바", desc: "카페", dist: "도보 2분", tag: "카페·디저트" },
              { name: "카페라이프", desc: "카페", dist: "도보 1분", tag: "카페·디저트" },
            ].map((place) => (
              <div key={place.name} className="flex items-center justify-between bg-[#faf9f7] rounded-xl px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${place.tag === "식당" ? "bg-[#ff6b35]/10 text-[#ff6b35]" : "bg-[#296973]/10 text-[#296973]"}`}>
                      {place.tag}
                    </span>
                    <span className="font-semibold text-[#372a14] text-sm">{place.name}</span>
                  </div>
                  <p className="text-xs text-gray-400">{place.desc}</p>
                </div>
                <p className="text-xs text-gray-400 text-right flex-shrink-0 ml-4">{place.dist}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Activity */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-sm font-semibold tracking-widest uppercase mb-3">Activity</p>
          <h2 className="text-2xl font-bold text-[#372a14] mb-8">안동에서 할 것들</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "🥋", name: "안동 탈춤 공연 관람" },
              { icon: "🛶", name: "낙동강 보트 타기" },
              { icon: "🥾", name: "학가산 트레킹" },
              { icon: "📸", name: "고택 사진 찍기" },
              { icon: "🎨", name: "도자기 체험" },
              { icon: "🌄", name: "월영교 야경 감상" },
              { icon: "📚", name: "퇴계 이황 발자취 탐방" },
              { icon: "🛍️", name: "전통시장 구경" },
            ].map((item) => (
              <div key={item.name} className="text-center p-4 bg-[#fffbde] rounded-xl">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-xs font-medium text-[#372a14] leading-tight">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Koinonia Day Guide — integrated */}
      <section className="py-24 px-6 md:px-16 bg-[#372a14] text-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/30 text-xs tracking-[0.3em] uppercase mb-4 font-medium">
            Koinonia + Andong
          </p>
          <h2 className="text-3xl md:text-4xl font-light mb-4">코이노니아와 함께하는 안동 여행</h2>
          <p className="text-white/50 text-sm mb-16 max-w-xl">
            안동을 구경하고 코이노니아로 돌아오는 하루.
            여기서의 밤은 다릅니다.
          </p>

          <div className="space-y-0">
            {[
              {
                time: "오전",
                timeEn: "Morning",
                icon: "☀️",
                title: "안동 구석구석",
                desc: "하회마을이나 도산서원, 안동 구시장을 느긋하게 둘러보세요. 찜닭 골목에서 점심도 빼놓지 말고.",
                tip: "대부분의 관광지는 코이노니아에서 차로 20~35분 거리입니다.",
              },
              {
                time: "오후",
                timeEn: "Afternoon",
                icon: "🌅",
                title: "살롱 공간 자유 이용",
                desc: "코이노니아로 돌아와 살롱 공간에서 쉬어가세요. 소파에 앉아 책을 읽거나, 준비된 커피와 차를 즐기며 여행의 피로를 씻어내세요.",
                tip: "스테이 투숙객은 공용 거실과 주방을 자유롭게 이용할 수 있습니다.",
              },
              {
                time: "수요일 저녁",
                timeEn: "Wednesday Evening",
                icon: "🍽️",
                title: "수요 포틀럭",
                desc: "각자의 음식을 하나씩 가져와 함께 나누는 저녁 모임. 안동에서 구한 음식이면 뭐든 환영입니다. 낯선 사람들과 저녁 한 끼.",
                linkHref: "/salon",
                linkLabel: "수요 포틀럭 신청 →",
                tip: "참가비 10,000원. 당일 신청도 가능합니다.",
              },
              {
                time: "금요일 저녁",
                timeEn: "Friday Evening",
                icon: "🌙",
                title: "프라이데이나잇",
                desc: "주말을 코이노니아에서 시작하는 금요일 밤. 다양한 사람들이 모여 이야기를 나누고 주말을 엽니다.",
                linkHref: "/salon",
                linkLabel: "프라이데이나잇 신청 →",
                tip: "참가비 30,000원.",
              },
              {
                time: "언제든",
                timeEn: "Anytime",
                icon: "📚",
                title: "Book & Beer",
                desc: "살롱 공간에서 책 한 권과 함께 조용한 밤을. 코이노니아 스토어에서 골라온 시집이나 에세이 한 권, 그리고 맥주 한 잔. 말하지 않아도 괜찮은 시간.",
                linkHref: "/store",
                linkLabel: "스토어 책 둘러보기 →",
                tip: "스테이 투숙객을 위한 비공식 프로그램.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 md:gap-8 py-8 border-b border-white/10 last:border-none"
              >
                <div>
                  <p className="text-[#ff6b35] text-xs tracking-[0.2em] uppercase font-medium mb-1">{item.time}</p>
                  <p className="text-white/30 text-xs">{item.timeEn}</p>
                </div>
                <div>
                  <h3 className="text-xl font-light text-white mb-3 flex items-center gap-3">
                    <span>{item.icon}</span>
                    {item.title}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-3">{item.desc}</p>
                  <p className="text-white/30 text-xs mb-4">{item.tip}</p>
                  {item.linkHref && (
                    <Link
                      href={item.linkHref}
                      className="text-[#ff6b35] text-sm hover:text-white transition-colors"
                    >
                      {item.linkLabel}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Medical */}
      <section className="py-14 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-sm font-semibold tracking-widest uppercase mb-3">Health</p>
          <h2 className="text-2xl font-bold text-[#372a14] mb-6">인근 병원 및 약국</h2>
          <div className="bg-white rounded-2xl border border-gray-100 px-7 py-6 space-y-3 text-sm text-gray-600 leading-relaxed">
            <p className="flex items-start gap-2">
              <span className="text-[#ff6b35] mt-0.5 flex-shrink-0">·</span>
              병원 및 약국 방문 전 운영 시간을 다시 한 번 직접 확인해 주세요.
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[#ff6b35] mt-0.5 flex-shrink-0">·</span>
              위급 상황 발생 시에는 <strong className="text-[#372a14]">119</strong>로 신고해 주세요.
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[#ff6b35] mt-0.5 flex-shrink-0">·</span>
              키친 싱크대 하단에 <strong className="text-[#372a14]">응급의약품 키트</strong>가 준비되어 있어요.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/stay"
            className="group bg-[#ff6b35] text-white rounded-2xl p-10 flex flex-col justify-between min-h-48 hover:bg-[#e55a25] transition-colors"
          >
            <p className="text-white/70 text-xs tracking-[0.2em] uppercase">Stay</p>
            <div>
              <h3 className="text-2xl font-light mb-3">스테이 예약하기</h3>
              <p className="text-white/70 text-sm group-hover:text-white transition-colors">
                나그네방, 옥순방, 여태방 →
              </p>
            </div>
          </Link>
          <Link
            href="/salon"
            className="group bg-[#372a14] text-white rounded-2xl p-10 flex flex-col justify-between min-h-48 hover:bg-[#4a3920] transition-colors"
          >
            <p className="text-white/40 text-xs tracking-[0.2em] uppercase">Salon</p>
            <div>
              <h3 className="text-2xl font-light mb-3">살롱 프로그램</h3>
              <p className="text-white/50 text-sm group-hover:text-white/80 transition-colors">
                수요 포틀럭, 프라이데이나잇 →
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
