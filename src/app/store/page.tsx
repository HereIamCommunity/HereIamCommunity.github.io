"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Book = {
  title: string;
  displayTitle: string;
  publisher: string;
  price: number;
  category: string;
};

function bookImagePath(title: string): string {
  const fname = title.replace(/[^\w가-힣]/g, "_") + ".jpg";
  return `/images/books/${fname}`;
}

const rawBooks: Book[] = [
  { title: "날씨와얼굴", displayTitle: "날씨와 얼굴", publisher: "위고", price: 15000, category: "에세이" },
  { title: "동료에게말걸기", displayTitle: "동료에게 말 걸기", publisher: "민음사", price: 18000, category: "에세이" },
  { title: "욕구들", displayTitle: "욕구들", publisher: "북하우스", price: 18000, category: "에세이" },
  { title: "모국어는차라리침묵", displayTitle: "모국어는 차라리 침묵", publisher: "아침달", price: 18600, category: "에세이" },
  { title: "돌봄선언", displayTitle: "돌봄 선언", publisher: "니케북스", price: 13800, category: "에세이" },
  { title: "그냥사람", displayTitle: "그냥 사람", publisher: "봄날의책", price: 13000, category: "에세이" },
  { title: "한국의능력주의", displayTitle: "한국의 능력주의", publisher: "이데아", price: 18000, category: "에세이" },
  { title: "비통한자들을위한정치학", displayTitle: "비통한 자들을 위한 정치학", publisher: "글항아리", price: 20000, category: "에세이" },
  { title: "지속의순간들", displayTitle: "지속의 순간들", publisher: "을유문화사", price: 22000, category: "에세이" },
  { title: "미쳐있고괴상하며오만하고똑똑한여자들", displayTitle: "미쳐있고 괴상하며 오만하고 똑똑한 여자들", publisher: "동아시아", price: 16000, category: "에세이" },
  { title: "멀고도가까운", displayTitle: "멀고도 가까운", publisher: "반비", price: 17000, category: "에세이" },
  { title: "사람장소환대", displayTitle: "사람 장소 환대", publisher: "문학과지성사", price: 16000, category: "에세이" },
  { title: "모든것이되는법", displayTitle: "모든 것이 되는 법", publisher: "웅진지식하우스", price: 17500, category: "에세이" },
  { title: "헤맨만큼내땅이다", displayTitle: "헤맨 만큼 내 땅이다", publisher: "필름", price: 19000, category: "에세이" },
  { title: "슬픔에이름붙이기", displayTitle: "슬픔에 이름 붙이기", publisher: "윌북", price: 18800, category: "에세이" },
  { title: "올어바웃러브", displayTitle: "올 어바웃 러브", publisher: "책읽는수요일", price: 15000, category: "에세이" },
  { title: "상처로숨쉬는법", displayTitle: "상처로 숨쉬는 법", publisher: "한겨레엔", price: 25000, category: "에세이" },
  { title: "있지만없는아이들", displayTitle: "있지만 없는 아이들", publisher: "창비", price: 18000, category: "에세이" },
  { title: "감정의문화정치", displayTitle: "감정의 문화정치", publisher: "오월의봄", price: 29800, category: "에세이" },
  { title: "다정한것이살아남는다", displayTitle: "다정한 것이 살아남는다", publisher: "디플롯", price: 22000, category: "에세이" },
  { title: "세계끝의버섯", displayTitle: "세계 끝의 버섯", publisher: "현실문화", price: 35000, category: "에세이" },
  { title: "묘사하는마음", displayTitle: "묘사하는 마음", publisher: "마음산책", price: 18000, category: "에세이" },
  { title: "무위의공동체", displayTitle: "무위의 공동체", publisher: "그린비", price: 21000, category: "에세이" },
  { title: "다정한서술자", displayTitle: "다정한 서술자", publisher: "민음사", price: 15000, category: "에세이" },
  { title: "자본주의리얼리즘", displayTitle: "자본주의 리얼리즘", publisher: "리시올", price: 15000, category: "에세이" },
  { title: "에세이스트의책상", displayTitle: "에세이스트의 책상", publisher: "문학동네", price: 12500, category: "에세이" },
  { title: "아침의피아노", displayTitle: "아침의 피아노", publisher: "한겨레출판", price: 17000, category: "에세이" },
  { title: "행복의약속", displayTitle: "행복의 약속", publisher: "후마니타스", price: 27000, category: "에세이" },
  { title: "글을쓰면서생각한것들", displayTitle: "글을 쓰면서 생각한 것들", publisher: "토스트", price: 18000, category: "에세이" },
  { title: "내가사랑한서점", displayTitle: "내가 사랑한 서점", publisher: "니라이카나이", price: 16800, category: "에세이" },
  { title: "후회하지않고사랑하는법", displayTitle: "후회하지 않고 사랑하는 법", publisher: "위즈덤하우스", price: 17000, category: "에세이" },
  { title: "어른의품위", displayTitle: "어른의 품위", publisher: "북로망스", price: 19500, category: "에세이" },
  { title: "좋아서그래", displayTitle: "좋아서 그래", publisher: "달출판사", price: 18000, category: "에세이" },
  { title: "비범한평범", displayTitle: "비범한 평범", publisher: "", price: 22000, category: "에세이" },
  { title: "불안의서", displayTitle: "불안의 서", publisher: "", price: 28000, category: "에세이" },
  { title: "헤테로토피아", displayTitle: "헤테로토피아", publisher: "", price: 13000, category: "에세이" },
  { title: "담론", displayTitle: "담론", publisher: "", price: 18000, category: "에세이" },
  { title: "다른방식으로보기", displayTitle: "다른 방식으로 보기", publisher: "", price: 15000, category: "에세이" },
  { title: "슬픔이두려운당신에게", displayTitle: "호라이즌", publisher: "", price: 35000, category: "에세이" },
  { title: "무지의즐거움", displayTitle: "무지의 즐거움", publisher: "", price: 18000, category: "에세이" },
  { title: "그러나아름다운", displayTitle: "그러나 아름다운", publisher: "", price: 18000, category: "에세이" },
  { title: "일의감각", displayTitle: "일의 감각", publisher: "", price: 22000, category: "에세이" },
  { title: "편안함의습격", displayTitle: "편안함의 습격", publisher: "", price: 22000, category: "에세이" },
  { title: "역사는어떻게진보하고왜퇴보하는가", displayTitle: "역사는 어떻게 진보하고 왜 퇴보하는가", publisher: "", price: 38000, category: "에세이" },
  { title: "경계에서는법", displayTitle: "경계에서 사는 법", publisher: "", price: 18000, category: "에세이" },
  { title: "인생의역사", displayTitle: "인생의 역사", publisher: "", price: 18000, category: "에세이" },
  { title: "우리에게는매일철학이필요하다", displayTitle: "우리에게는 매일 철학이 필요하다", publisher: "", price: 17800, category: "에세이" },
  { title: "오래된세계의농담", displayTitle: "오래된 세계의 농담", publisher: "", price: 18000, category: "에세이" },
  { title: "몽테뉴사유의힘", displayTitle: "몽테뉴 사유의 힘", publisher: "필름", price: 19000, category: "에세이" },
  { title: "정신머리", displayTitle: "정신머리", publisher: "민음사", price: 13000, category: "시" },
  { title: "당신은나의높이를가지세요", displayTitle: "당신은 나의 높이를 가지세요", publisher: "창비", price: 14000, category: "시" },
  { title: "우울과경청", displayTitle: "우울과 경청", publisher: "창비", price: 13000, category: "시" },
  { title: "여름언덕에서배운것", displayTitle: "여름 언덕에서 배운 것", publisher: "창비", price: 13000, category: "시" },
  { title: "거침없이내성적인", displayTitle: "거침없이 내성적인", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "괴괴한날씨와착한사람들", displayTitle: "괴괴한 날씨와 착한 사람들", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "사랑과멸종을바꿔읽어보십시오", displayTitle: "사랑과 멸종을 바꿔 읽어보십시오", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "오늘사회발코니", displayTitle: "오늘 사회 발코니", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "무족영원", displayTitle: "무족영원", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "도움받는기분", displayTitle: "도움받는 기분", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "사춘기", displayTitle: "사춘기", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "입속의검은잎", displayTitle: "입 속의 검은 잎", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "이시대의사랑", displayTitle: "이 시대의 사랑", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "이걸내마음이라고하자", displayTitle: "이걸 내 마음이라고 하자", publisher: "문학동네", price: 12000, category: "시" },
  { title: "나는나를사랑해서나를혐오하고", displayTitle: "나는 나를 사랑해서 나를 혐오하고", publisher: "문학동네", price: 12000, category: "시" },
  { title: "언니의나라에선누구도시들지않기때문", displayTitle: "언니의 나라에선 누구도 시들지 않기 때문", publisher: "문학동네", price: 12000, category: "시" },
  { title: "지구만큼슬펐다고한다", displayTitle: "지구만큼 슬펐다고 한다", publisher: "문학동네", price: 12000, category: "시" },
  { title: "나는잠깐설웁다", displayTitle: "나는 잠깐 설웁다", publisher: "문학동네", price: 12000, category: "시" },
  { title: "영원금지소년금지천사금지", displayTitle: "영원 금지 소년 금지 천사 금지", publisher: "문학동네", price: 12000, category: "시" },
  { title: "사랑하고선량하게잦아드네", displayTitle: "사랑하고 선량하게 잦아드네", publisher: "문학동네", price: 12000, category: "시" },
  { title: "살것만같던마음", displayTitle: "살 것만 같던 마음", publisher: "창비", price: 10000, category: "시" },
  { title: "꿈꾸는소리하고자빠졌네", displayTitle: "꿈꾸는 소리 하고 자빠졌네", publisher: "창비", price: 11000, category: "시" },
  { title: "누군가가누군가를부르면내가돌아보았다", displayTitle: "누군가가 누군가를 부르면 내가 돌아보았다", publisher: "창비", price: 14000, category: "시" },
  { title: "사랑을위한되풀이", displayTitle: "사랑을 위한 되풀이", publisher: "창비", price: 13000, category: "시" },
  { title: "온우주가바라는나의건강한삶", displayTitle: "온 우주가 바라는 나의 건강한 삶", publisher: "창비", price: 12000, category: "시" },
  { title: "나쁘게눈부시기", displayTitle: "나쁘게 눈부시기", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "나는오래된거리처럼너를사랑하고", displayTitle: "나는 오래된 거리처럼 너를 사랑하고", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "검은머리짐승사전", displayTitle: "검은머리 짐승 사전", publisher: "민음사", price: 12000, category: "시" },
  { title: "나랑하고시픈게뭐에여", displayTitle: "나랑 하고 시픈 게 뭐에여", publisher: "민음사", price: 10000, category: "시" },
  { title: "너와바꿔부를수있는것", displayTitle: "너와 바꿔 부를 수 있는 것", publisher: "창비", price: 11000, category: "시" },
  { title: "호시절", displayTitle: "호시절", publisher: "창비", price: 9000, category: "시" },
  { title: "서로에게기대서끝까지", displayTitle: "서로에게 기대서 끝까지", publisher: "창비", price: 14000, category: "시" },
  { title: "훔쳐가는노래", displayTitle: "훔쳐가는 노래", publisher: "창비", price: 13000, category: "시" },
  { title: "사랑은탄생하라", displayTitle: "사랑은 탄생하라", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "극에달하다", displayTitle: "극에 달하다", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "불쌍한사랑기계", displayTitle: "불쌍한 사랑 기계", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "우리의대화는이런것입니다", displayTitle: "우리의 대화는 이런 것입니다", publisher: "문학동네", price: 12000, category: "시" },
  { title: "다만이야기가남았네", displayTitle: "다만 이야기가 남았네", publisher: "문학동네", price: 10000, category: "시" },
  { title: "이런얘기는좀어지러운가", displayTitle: "이런 얘기는 좀 어지러운가", publisher: "문학동네", price: 12000, category: "시" },
  { title: "빌어먹을차가운심장", displayTitle: "빌어먹을 차가운 심장", publisher: "문학동네", price: 12000, category: "시" },
  { title: "기억몸짓", displayTitle: "기억 몸짓", publisher: "문학동네", price: 12000, category: "시" },
  { title: "휴일에하는용서", displayTitle: "휴일에 하는 용서", publisher: "창비", price: 11000, category: "시" },
  { title: "서랍에저녁을넣어두었다", displayTitle: "서랍에 저녁을 넣어두었다", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "즐거운일기", displayTitle: "즐거운 일기", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "빈배처럼텅비어", displayTitle: "빈 배처럼 텅 비어", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "당신의이름을지어다가며칠은먹었다", displayTitle: "당신의 이름을 지어다가 며칠은 먹었다", publisher: "문학동네", price: 12000, category: "시" },
  { title: "폭포열기", displayTitle: "폭포 열기", publisher: "문학과지성사", price: 12000, category: "시" },
  { title: "밤과꿈의뉘앙스", displayTitle: "밤과 꿈의 뉘앙스", publisher: "민음사", price: 12000, category: "시" },
  { title: "저녁의구애", displayTitle: "저녁의 구애", publisher: "", price: 11000, category: "시" },
  { title: "정확한사랑의실험", displayTitle: "정확한 사랑의 실험", publisher: "", price: 16000, category: "시" },
  { title: "히로시마내사랑", displayTitle: "히로시마 내 사랑", publisher: "", price: 11000, category: "시" },
  { title: "꽤낙천적인아이", displayTitle: "꽤 낙천적인 아이", publisher: "민음사", price: 15000, category: "소설" },
  { title: "아무것도아니라고잘라말하기", displayTitle: "아무것도 아니라고 잘라 말하기", publisher: "문학과지성사", price: 14000, category: "소설" },
  { title: "조금망한사랑", displayTitle: "조금 망한 사랑", publisher: "문학동네", price: 17000, category: "소설" },
  { title: "내가말하고있잖아", displayTitle: "내가 말하고 있잖아", publisher: "민음사", price: 14000, category: "소설" },
  { title: "단순한진심", displayTitle: "단순한 진심", publisher: "민음사", price: 13000, category: "소설" },
  { title: "거의사랑하는거말고", displayTitle: "거의 사랑하는 거 말고", publisher: "문학동네", price: 17000, category: "소설" },
  { title: "기다릴때우리가하는말들", displayTitle: "기다릴 때 우리가 하는 말들", publisher: "민음사", price: 14000, category: "소설" },
  { title: "내게무해한사람", displayTitle: "내게 무해한 사람", publisher: "문학동네", price: 16000, category: "소설" },
  { title: "내일의연인들", displayTitle: "내일의 연인들", publisher: "문학동네", price: 15000, category: "소설" },
  { title: "느리게가는마음", displayTitle: "느리게 가는 마음", publisher: "창비", price: 17000, category: "소설" },
  { title: "각각의계절", displayTitle: "각각의 계절", publisher: "문학동네", price: 15000, category: "소설" },
  { title: "작별들순간들", displayTitle: "작별들 순간들", publisher: "문학동네", price: 16000, category: "소설" },
  { title: "영원을향하여", displayTitle: "영원을 향하여", publisher: "반타", price: 17800, category: "소설" },
  { title: "아버지의해방일지", displayTitle: "아버지의 해방일지", publisher: "창비", price: 17000, category: "소설" },
  { title: "급류", displayTitle: "급류", publisher: "민음사", price: 14000, category: "소설" },
  { title: "사랑과결함", displayTitle: "사랑과 결함", publisher: "문학동네", price: 16500, category: "소설" },
  { title: "술꾼들의모국어", displayTitle: "술꾼들의 모국어", publisher: "한겨레출판", price: 16800, category: "소설" },
  { title: "천국보다낯선", displayTitle: "천국보다 낯선", publisher: "민음사", price: 14000, category: "소설" },
  { title: "우리에게없는밤", displayTitle: "우리에게 없는 밤", publisher: "", price: 17000, category: "소설" },
  { title: "모든것은영원했다", displayTitle: "모든 것은 영원했다", publisher: "", price: 13000, category: "소설" },
  { title: "적어도두번", displayTitle: "적어도 두 번", publisher: "", price: 13000, category: "소설" },
  { title: "그녀를지키다", displayTitle: "그녀를 지키다", publisher: "", price: 22000, category: "소설" },
  { title: "알려지지않은예술가의눈물과자이툰파스타", displayTitle: "알려지지 않은 예술가의 눈물과 자이툰 파스타", publisher: "", price: 13500, category: "소설" },
  { title: "소", displayTitle: "소", publisher: "", price: 16800, category: "소설" },
  { title: "이육사작품집", displayTitle: "이육사 작품집", publisher: "", price: 15000, category: "소설" },
  { title: "네통의편지", displayTitle: "네 통의 편지", publisher: "", price: 14000, category: "소설" },
  { title: "극장에는항상상훈이형이있다", displayTitle: "극장에는 항상 상훈이 형이 있다", publisher: "", price: 18500, category: "소설" },
  { title: "당신은사람보는눈이필요하군요", displayTitle: "당신은 사람 보는 눈이 필요하군요", publisher: "", price: 16800, category: "소설" },
];

const CATEGORIES = ["전체", "시", "소설", "에세이"] as const;
type Category = typeof CATEGORIES[number];

function cleanTitle(title: string): string {
  // Remove series info in parentheses and numbers
  return title
    .replace(/\(.*?\)/g, "")
    .replace(/-\d+$/, "")
    .trim();
}

export default function StorePage() {
  const [category, setCategory] = useState<Category>("전체");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return rawBooks.filter((b) => {
      const matchCat = category === "전체" || b.category === category;
      const matchSearch =
        !search ||
        b.displayTitle.includes(search) ||
        b.publisher.includes(search);
      return matchCat && matchSearch;
    });
  }, [category, search]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { 전체: rawBooks.length };
    for (const c of ["시", "소설", "에세이"]) {
      result[c] = rawBooks.filter((b) => b.category === c).length;
    }
    return result;
  }, []);

  return (
    <div className="pt-14 md:pt-16 min-h-screen bg-[#faf9f7]">
      {/* Hero */}
      <section className="bg-[#372a14] text-white py-20 px-6 md:py-28">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.3em] uppercase mb-4 font-medium">
            Store · 스토어
          </p>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight mb-6">
            코이노니아의 책
          </h1>
          <p className="text-white/60 text-base md:text-lg leading-relaxed max-w-xl">
            우리가 선택한 시집, 소설, 에세이.<br />
            <span className="text-white/40 text-sm">Books we love, curated for the curious mind.</span>
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-14 md:top-16 z-30 bg-[#faf9f7]/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          {/* Category tabs */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? "bg-[#372a14] text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {cat}
                <span className="ml-1.5 text-xs opacity-60">{counts[cat]}</span>
              </button>
            ))}
          </div>
          {/* Search */}
          <input
            type="text"
            placeholder="책 제목 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-200 rounded-full px-4 py-1.5 text-sm w-full sm:w-52 focus:outline-none focus:border-[#372a14] bg-white"
          />
        </div>
      </section>

      {/* Book grid */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-sm text-gray-400 mb-8">
          {filtered.length}권
          {search && <span className="ml-2 text-[#ff6b35]">&#34;{search}&#34; 검색 결과</span>}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((book, i) => (
            <div
              key={i}
              className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-[#372a14]/30 hover:shadow-md transition-all duration-300"
            >
              {/* Book cover image */}
              <div className="h-48 relative overflow-hidden bg-gray-50 flex items-center justify-center">
                <Image
                  src={bookImagePath(book.displayTitle)}
                  alt={book.displayTitle}
                  fill
                  className="object-contain p-1"
                  onError={(e) => {
                    const t = e.currentTarget as HTMLImageElement;
                    t.style.display = "none";
                    if (t.parentElement) {
                      t.parentElement.style.background = `hsl(${(i * 47 + 30) % 360}, 20%, 88%)`;
                    }
                  }}
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                />
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-[#372a14] leading-snug mb-1 group-hover:text-[#ff6b35] transition-colors line-clamp-2">
                  {book.displayTitle}
                </h3>
                {book.publisher && (
                  <p className="text-xs text-gray-400 mb-2">{book.publisher}</p>
                )}
                <p className="text-sm font-bold text-[#372a14]">
                  {book.price.toLocaleString()}원
                </p>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">📚</p>
            <p>검색 결과가 없습니다.</p>
          </div>
        )}
      </section>

      {/* Purchase info */}
      <section className="bg-[#372a14] text-white py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-light mb-4">구매 방법</h2>
          <p className="text-white/60 leading-relaxed mb-8">
            온라인 주문 또는 코이노니아 살롱 방문 시 직접 구매 가능합니다.<br />
            <span className="text-white/40 text-sm">Purchase in-store or contact us via Instagram DM.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://instagram.com/koinonia_andong"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#372a14] font-semibold px-8 py-3 rounded-full hover:bg-[#ff6b35] hover:text-white transition-colors"
            >
              인스타그램 DM으로 주문
            </a>
            <a
              href="mailto:koinonia2026@naver.com"
              className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-semibold px-8 py-3 rounded-full hover:border-white transition-colors"
            >
              이메일 문의
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
