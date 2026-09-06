"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

/* ─── 회차 데이터 ──────────────────────────── */
const SESSIONS = [
  { id: "s1", round: "1회차", dates: "7월 3–5일", days: "금 · 토 · 일" },
  { id: "s2", round: "2회차", dates: "7월 24–26일", days: "금 · 토 · 일" },
  { id: "s3", round: "3회차", dates: "7월 30일 – 8월 1일", days: "목 · 금 · 토" },
  { id: "s4", round: "4회차", dates: "8월 15–17일", days: "토 · 일 · 월" },
  { id: "s5", round: "5회차", dates: "8월 21–23일", days: "금 · 토 · 일" },
];

const MAX = 6;

/* ─── 커뮤니티 룰 ───────────────────────────── */
const RULES = [
  {
    num: "01",
    title: "처음 해보는 일에 도전하기",
    desc: "해보지 않은 일 앞에서 주저할 수 있어요. 그래도 포기하지 마세요. 도전한 것 자체가 이미 모험입니다.",
    emoji: "🚀",
  },
  {
    num: "02",
    title: "서로의 곁이 되어주기",
    desc: "72시간 동안 우리는 서로의 환경이 됩니다. 방관자가 아닌 참여자로서, 옆에 있는 친구에게 마음을 써주세요.",
    emoji: "🤝",
  },
  {
    num: "03",
    title: "먼저 다가가기",
    desc: "기다리지 마세요. 먼저 말을 걸고, 먼저 손을 내밀고, 먼저 웃어보세요. 모든 우정은 누군가의 첫 발걸음에서 시작됐어요.",
    emoji: "👋",
  },
];

/* ─── 준비물 ────────────────────────────────── */
const PACK = [
  { icon: "👕", text: "2박 3일 입을 옷 & 운동화, 칫솔" },
  { icon: "📸", text: "내가 속한 지역의 사진 몇 장" },
  { icon: "✨", text: "즐거운 마음과 기대감" },
];

/* ─── 신청자 이야기 ──────────────────────────── */
type Segment = { text: string; hi: boolean };
const STORIES: { emoji: string; color: string; segments: Segment[] }[] = [
  {
    emoji: "💪",
    color: "#FFD166",
    segments: [
      { text: "4회차 썸머캠프에는 ", hi: false },
      { text: "마음은 여리지만 걸크러쉬가 추구미인", hi: true },
      { text: " 여자 친구가 와요. 사춘기가 살짝 오고 있어서 감정 변화가 급격할 수 있다는 어머니의 이야기에, 호스트는 자신의 사춘기 소녀 시절을 떠올려 봤습니다. 어머니, 저희가 잘 지켜볼게요.", hi: false },
    ],
  },
  {
    emoji: "🎒",
    color: "#96d7e2",
    segments: [
      { text: "이번 캠프에는 ", hi: false },
      { text: "부모님 곁을 떠나 홀로 여행을 떠나보는 친구가 세 명", hi: true },
      { text: "이나 된대요. 부모님에게도 아이에게도 가슴 떨릴 이번 썸머캠프. 두려움 반 두근거림 반이겠지만, 마지막엔 ", hi: false },
      { text: "'우리 정말 좋은 선택이었다'", hi: true },
      { text: "는 생각이 들 수 있도록 행복한 추억 만들어 드릴게요.", hi: false },
    ],
  },
  {
    emoji: "🚿",
    color: "#b8e0a8",
    segments: [
      { text: "화장실을 잘 가야 예민하지 않아요, 낯을 가리고 자기 생각을 깊게 하는 친구라서요, 양치·샤워를 했다고 하는데 가끔 거짓말인 경우가 있어요… ", hi: false },
      { text: "부모님들의 소소한 걱정", hi: true },
      { text: "을 잘 받아 보았습니다. 조금 실수해도 괜찮은 여정이 되길 바라요. 함께하는 시간 동안 저희가 잘 보살피겠습니다.", hi: false },
    ],
  },
];

/* ─── FAQ ───────────────────────────────────── */
const FAQS = [
  {
    q: "썸머캠프 도착과 출발은 어떻게 하나요?",
    a: [
      "썸머캠프는 1일차 점심 12시에 시작해서, 3일차 오후 3시에 끝날 예정입니다. 안동까지는 버스와 기차를 이용해 주세요. 오전 11–12시 사이에 도착할 수 있도록 미리 예매해 주시길 바랍니다.",
      "캠프 일주일 전에 호스트에게 버스 혹은 기차 티켓을 보내주시면, 도착 시간을 확인해서 직접 픽업 나갈 예정입니다.",
      "아이가 집을 떠나 안동까지 무사히 올 수 있도록 격려해 주세요. 무엇을 조심해야 한다는 안내는 저희가 자녀분에게 전달하겠습니다. 부모님은 격려와 응원으로 아이를 떠나보내 주세요.",
    ],
  },
  {
    q: "사고 발생 시 어떻게 대처하나요?",
    a: [
      "썸머캠프 모든 참여자를 위해 여행자 보험에 가입합니다. 호스트가 24시간 아이들 곁에 상주하며 안전 사고를 예방해요.",
      "만약 사고 발생 시에는 인근 안동 병원에 직접 동행하고, 부모님께 상황을 바로 설명드리겠습니다.",
    ],
  },
  {
    q: "끼니는 어떻게 제공되나요?",
    a: [
      "캠프 신청 시 남겨주신 알레르기 음식을 참고해서 식사를 준비하겠습니다. 캠프 현장에서도 아이들에게 알레르기 여부를 재확인해 주의하도록 할게요.",
    ],
  },
  {
    q: "캠프 중에 핸드폰을 사용할 수 있나요?",
    a: [
      "네, 당연히 가능합니다. 핸드폰 사용에 특별한 제약을 두기보다, 아이들이 서로에게 친밀해질 수 있도록 분위기를 조성하는 데 저희가 기여할게요.",
    ],
  },
  {
    q: "준비물은 무엇인가요?",
    a: [
      "개별 옷가지와 개인 비상약품, 위생용품 등을 지참해 주세요.",
      "추가로 필요한 물건이 있다면 안동에서 구매할 수 있으니 걱정하지 마세요.",
    ],
  },
  {
    q: "어떤 친구들이 오나요?",
    a: [
      "현재 초등학교 5, 6학년 학생들의 참여가 두드러집니다. 중·고등학교 형, 누나들의 많은 참여를 바라요!",
    ],
  },
];

/* ─── 타임테이블 ─────────────────────────────── */
const TIMETABLE = [
  {
    day: "Day 1",
    date: "금요일",
    theme: "우리, 친구가 되는 날",
    color: "#ff6b35",
    bg: "bg-[#ff6b35]",
    slots: [
      { time: "12:00", activity: "안동 도착 · 픽업", note: "안동역 · 버스터미널 (하영 픽업)" },
      { time: "13:00", activity: "체크인 · 점심식사", note: "산청식당 간고등어정식" },
      { time: "14:00", activity: "리트릿 오리엔테이션", note: "2박 3일 일정 및 캠프 즐기는 법 안내" },
      { time: "15:00", activity: "하회마을 모험 투어", note: "구석구석 미션을 수행하며 친구 사귀기" },
      { time: "18:00", activity: "🍲 찜닭 함께 만들기", note: "함께 요리하는 첫 번째 저녁" },
      { time: "20:00", activity: "✨ 서로 알아가는 밤", note: "나의 물리적·정서적 환경 소개하기" },
      { time: "22:00", activity: "개인 정비 · 취침", note: "" },
    ],
  },
  {
    day: "Day 2",
    date: "토요일",
    theme: "우리의 여름을 만드는 날",
    color: "#296973",
    bg: "bg-[#296973]",
    slots: [
      { time: "08:00", activity: "🌅 기상 미션", note: "" },
      { time: "09:00", activity: "아침식사", note: "시장에서 사온 김밥 · 시리얼" },
      { time: "10:00", activity: "🎵 싱잉볼 & 눈맞춤 명상", note: "안내자 재철과 함께" },
      { time: "12:00", activity: "🛒 전통시장 장보기", note: "안동중앙신시장 · 물놀이 간식 구매" },
      { time: "14:00", activity: "🌊 강변 물놀이", note: "" },
      { time: "18:00", activity: "🔥 루프탑 바베큐", note: "호스트가 준비하는 안전한 저녁" },
      { time: "20:00", activity: "🎭 연극 워크샵", note: "예빈 선생님과 함께" },
      { time: "22:00", activity: "개인 정비 · 취침", note: "" },
    ],
  },
  {
    day: "Day 3",
    date: "일요일",
    theme: "나의 여행을 시작하는 날",
    color: "#372a14",
    bg: "bg-[#372a14]",
    slots: [
      { time: "08:00", activity: "☀️ 기상 미션", note: "" },
      { time: "09:00", activity: "아침식사", note: "갓 구운 빵 · 시리얼" },
      { time: "11:30", activity: "체크아웃 · 짐 정리", note: "" },
      { time: "13:00", activity: "🍔 점심식사", note: "말콥버거 · 아차가 젤라또" },
      { time: "14:00", activity: "🗺️ 안동 원도심 자유여행", note: "사랑하는 사람을 위한 선물 사기" },
      { time: "16:00", activity: "🚎 집으로 출발", note: "" },
    ],
  },
];

/* ─── 학년 옵션 ─────────────────────────────── */
const GRADES = [
  "초등학교 5학년", "초등학교 6학년",
  "중학교 1학년", "중학교 2학년", "중학교 3학년",
  "고등학교 1학년",
];

export default function RetreatPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState({
    name: "", phone: "", email: "", grade: "", region: "",
    session: "", referral: "", question: "", memo: "",
    allergy: "", care: "", parentNote: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    fetch("/api/retreat")
      .then((r) => r.json())
      .then((d) => setCounts(d.counts ?? {}))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.grade || !form.session) {
      setError("이름, 연락처, 학년, 희망 회차는 필수예요.");
      return;
    }
    const cnt = counts[form.session] ?? 0;
    if (cnt >= MAX) {
      setError("선택한 회차가 마감됐어요. 다른 회차를 선택해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/retreat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setDone(true);
        setCounts((prev) => ({ ...prev, [form.session]: (prev[form.session] ?? 0) + 1 }));
      } else {
        setError(json.message ?? "오류가 발생했어요. 다시 시도해주세요.");
      }
    } catch {
      setError("서버 연결 오류. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-[#faf9f7] min-h-screen">

      {/* ── 1. HERO ── */}
      <section className="relative min-h-[90vh] flex flex-col justify-end overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/retreat/river-golden.jpg"
            alt="안동 강변"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1208]/90 via-[#1a1208]/40 to-[#1a1208]/10" />
        </div>
        <div className="relative z-10 px-6 md:px-16 pb-16 md:pb-24 max-w-5xl">
          <p className="text-white/40 text-[10px] tracking-[0.4em] uppercase mb-6 font-light">
            Koinonia · Andong · Summer 2026
          </p>
          <p className="text-[#ff6b35] text-sm tracking-widest mb-3 font-medium">🌀 72시간</p>
          <h1 className="text-[clamp(3.5rem,11vw,8rem)] font-light text-white leading-[0.88] tracking-tight mb-6">
            썸머캠프
          </h1>
          <p className="text-white/60 text-base md:text-lg font-light leading-relaxed max-w-lg mb-3">
            로컬호스트 하영<br />
            청소년기 잊지 못할 여름날의 72시간
          </p>
          <p className="inline-block bg-white text-[#372a14] text-[11px] font-semibold tracking-wider px-3 py-1 rounded-full mb-3">
            전 회차 마감 · 대기 신청 접수 중
          </p>
          <p className="text-white/35 text-sm mb-10">
            초등학교 5학년 – 고등학교 1학년 · 회차별 6명 모집 · 참가비 44만원
          </p>
          <a
            href="#apply"
            className="inline-block px-8 py-3.5 bg-[#ff6b35] text-white text-sm font-semibold rounded-full hover:bg-[#e55a25] transition-colors"
          >
            대기 신청하기 ↓
          </a>
        </div>
      </section>

      {/* ── 2. 캠프 소개 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-6 font-medium">
              About · 캠프 소개
            </p>
            <h2 className="text-3xl md:text-4xl font-light text-[#372a14] leading-[1.2] mb-8">
              모든 성장은<br />
              미지의 모험에서<br />
              시작됩니다.
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed text-sm md:text-[15px]">
              <p>
                집 밖을 나선 청소년을 기다리고 있는 건 무서운 세상이 아니라<br />
                스스로 무언가를 해볼 수 있는 자유,<br />
                그리고 서로를 지지해줄 든든한 친구들입니다.
              </p>
              <p>
                전국 각지에서 온, 서로 다른 매력의 친구들을 모집해요.<br />
                2026년 여름, 잊지 못할 72시간의 추억을 함께 만들어 갑니다.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 bg-[#296973]/10 text-[#296973] text-xs font-semibold px-4 py-2 rounded-full">
                🛡️ 참가자 전원 여행자 보험 가입
              </span>
              <span className="inline-flex items-center gap-2 bg-[#ff6b35]/10 text-[#ff6b35] text-xs font-semibold px-4 py-2 rounded-full">
                👨‍👩‍👧 호스트 상주 · 24시간 케어
              </span>
            </div>
          </div>
          {/* 포스터 + 호스트 사진 레이어드 */}
          <div className="relative aspect-[4/5] max-w-sm mx-auto md:mx-0">
            {/* 호스트 사진 — 메인 배경 */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-xl">
              <Image
                src="/retreat/hosts.jpg"
                alt="호스트 예빈과 하영"
                fill
                className="object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#372a14]/20 to-transparent" />
            </div>
            {/* 포스터 — 우측 상단, 뻗은 팔 위로 */}
            <div className="absolute -top-5 -right-5 w-[52%] rounded-xl overflow-hidden shadow-2xl border-[3px] border-white rotate-[4deg] hover:rotate-0 transition-transform duration-300">
              <div className="relative aspect-[3/4]">
                <Image
                  src="/retreat/poster.png"
                  alt="72시간 썸머캠프 포스터"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. 호스트 소개 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-[#372a14]">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/30 text-xs tracking-[0.35em] uppercase mb-12 font-medium">
            Your Hosts · 호스트 소개
          </p>
          <div className="grid md:grid-cols-2 gap-10 md:gap-16">
            <div className="bg-white/5 rounded-2xl p-8">
              <p className="text-[#ff6b35] text-[10px] tracking-[0.3em] uppercase font-semibold mb-1">Camp Host</p>
              <h3 className="text-2xl font-light text-white mb-1">예빈</h3>
              <p className="text-white/30 text-xs mb-4">연극 연출가 & 교육자 · @ye22in</p>
              <p className="text-white/65 text-sm leading-relaxed">
                매주 초등학생들을 만나 연극 수업을 이끄는 선생님.
                신문방송학·연극학·평생교육학을 전공했습니다.
                무대와 교실 사이에서 아이들이 자신의 이야기를 발견하도록 돕습니다.
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-8">
              <p className="text-[#ff6b35] text-[10px] tracking-[0.3em] uppercase font-semibold mb-1">Camp Host</p>
              <h3 className="text-2xl font-light text-white mb-1">하영</h3>
              <p className="text-white/30 text-xs mb-4">커뮤니티 매니저 · @sunlike.chloe</p>
              <p className="text-white/65 text-sm leading-relaxed">
                가정, 교회, 사회를 넘나들며 전 연령대와 소통해온 커뮤니티 매니저.
                큰 프로젝트의 기획부터 현장 운영까지,
                안전하고 즐거운 경험을 만드는 전문가입니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. 코이노니아가 준비해요 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-[#372a14]">
        <div className="max-w-5xl mx-auto">
          <p className="text-white/30 text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            What We Prepare · 코이노니아가 준비해요
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-white mb-12">
            이건 저희가 다 챙길게요
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: "🏠",
                title: "숙소",
                items: ["호스트 24시간 상주", "개별 침대와 침구", "수건 · 샴푸 · 바디워시 · 폼클렌저 · 치약", "헤어드라이기와 빗", "응급의약품"],
              },
              {
                icon: "🎪",
                title: "프로그램",
                items: ["하회마을 모험 투어", "싱잉볼 & 눈맞춤 명상", "강변 물놀이", "루프탑 바베큐", "연극 워크샵"],
              },
              {
                icon: "🍳",
                title: "식사 & 서비스",
                items: ["아침 조식 (김밥 · 빵 · 차)", "점심 · 저녁 동행", "참가자 여행자 보험 가입", "친구들을 위한 고민 상담"],
              },
            ].map((cat) => (
              <div key={cat.title} className="bg-white/5 rounded-2xl p-7">
                <div className="text-3xl mb-4">{cat.icon}</div>
                <h3 className="text-white font-semibold mb-4">{cat.title}</h3>
                <ul className="space-y-2">
                  {cat.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/60">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-[#ff6b35] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-white/30 text-xs mt-8 leading-relaxed">
            * 모든 프로그램은 참여자 컨디션에 따라 선택 참여 가능합니다. 아이들의 몸과 마음의 컨디션을 가장 중요하게 생각해요.
          </p>
        </div>
      </section>

      {/* ── 5. 숙소 안내 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            Where We Stay · 우리가 머무는 곳
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-3">코이노니아 스테이</h2>
          <p className="text-gray-500 text-sm mb-10 max-w-lg">
            호스트가 직접 리모델링한 코이노니아 스테이에서 6명의 친구들이 함께 지냅니다.
          </p>
          <div className="grid md:grid-cols-2 gap-5 mb-8">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] group">
              <Image
                src="/images/stay/yeutae-3.jpg"
                alt="여태방 도미토리"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1208]/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5">
                <p className="text-white font-semibold text-sm">여태방</p>
                <p className="text-white/70 text-xs">벙커베드 도미토리</p>
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] group">
              <Image
                src="/images/salon/living-1.jpg"
                alt="공용 거실"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1208]/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5">
                <p className="text-white font-semibold text-sm">공용 거실</p>
                <p className="text-white/70 text-xs">함께 이야기 나누는 공간</p>
              </div>
            </div>
          </div>
          <div className="bg-[#faf9f7] rounded-2xl p-6 border border-gray-100 text-sm text-gray-600 leading-relaxed">
            <p className="font-semibold text-[#372a14] mb-2">🏠 숙소 안내</p>
            <p>
              초등·중등·고등이 함께 자는 도미토리이며, 코이노니아 스테이를 6명 친구가 모두 함께 사용합니다.
              방 배정은 랜덤으로 진행되며,{" "}
              <strong className="text-[#372a14]">호스트가 함께 생활하며 아이들의 안전을 보호합니다.</strong>
              {" "}특별한 사유가 있을 경우 신청서에 남겨주시면 참작하여 배정합니다.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6. 상세 타임테이블 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            Schedule · 상세 일정
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-2">시간표</h2>
          <p className="text-gray-400 text-sm mb-10">날짜를 선택하면 상세 일정을 확인할 수 있어요.</p>

          {/* 탭 */}
          <div className="flex gap-2 mb-8">
            {TIMETABLE.map((t, i) => (
              <button
                key={t.day}
                onClick={() => setSelectedDay(i)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  selectedDay === i
                    ? "text-white shadow-sm"
                    : "bg-[#faf9f7] text-gray-400 hover:text-gray-600"
                }`}
                style={selectedDay === i ? { backgroundColor: t.color } : {}}
              >
                <span className="block text-xs font-normal opacity-70">{t.date}</span>
                {t.day}
              </button>
            ))}
          </div>

          {/* 선택된 날 일정 */}
          {(() => {
            const t = TIMETABLE[selectedDay];
            return (
              <div>
                <div className="flex items-center gap-3 mb-6 px-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                  <p className="text-sm font-semibold text-[#372a14]">{t.theme}</p>
                </div>
                <div className="space-y-1">
                  {t.slots.map((slot, i) => (
                    <div
                      key={i}
                      className="flex gap-4 md:gap-6 items-start py-3.5 px-4 rounded-xl hover:bg-[#faf9f7] transition-colors"
                    >
                      <span
                        className="text-xs font-bold tabular-nums shrink-0 pt-0.5 w-12 text-right"
                        style={{ color: t.color }}
                      >
                        {slot.time}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#372a14]">{slot.activity}</p>
                        {slot.note && (
                          <p className="text-xs text-gray-400 mt-0.5">{slot.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── 6. 커뮤니티 룰 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-[#ff6b35]/5">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            Community Rules · 우리의 약속
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-12">함께 지키는 세 가지</h2>
          <div className="space-y-5">
            {RULES.map((rule) => (
              <div
                key={rule.num}
                className="bg-white rounded-2xl p-7 flex gap-6 items-start shadow-sm border border-[#ff6b35]/5"
              >
                <span className="text-4xl flex-shrink-0">{rule.emoji}</span>
                <div>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-[#ff6b35] text-xs font-bold tracking-[0.2em]">{rule.num}</span>
                    <h3 className="text-base md:text-lg font-semibold text-[#372a14]">{rule.title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. 준비물 ── */}
      <section className="py-16 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">Packing List · 준비물</p>
          <h2 className="text-2xl font-light text-[#372a14] mb-8">이것만 챙겨오세요</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PACK.map((item) => (
              <div key={item.text} className="flex items-center gap-4 bg-[#faf9f7] rounded-2xl px-5 py-4">
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <p className="text-sm text-gray-700 leading-snug">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. 신청자 이야기 ── */}
      <section className="relative overflow-hidden py-24 md:py-32 px-6 md:px-16" style={{ background: "linear-gradient(180deg, #d4eaf7 0%, #e8f5e1 50%, #f5f0e8 100%)" }}>
        {/* 해 */}
        <svg className="absolute top-6 right-8 md:right-20 opacity-80" width="90" height="90" viewBox="0 0 90 90" fill="none">
          <circle cx="45" cy="45" r="22" fill="#FFD166" />
          {[0,45,90,135,180,225,270,315].map((deg, i) => (
            <line key={i}
              x1={45 + 28 * Math.cos(deg * Math.PI / 180)}
              y1={45 + 28 * Math.sin(deg * Math.PI / 180)}
              x2={45 + 38 * Math.cos(deg * Math.PI / 180)}
              y2={45 + 38 * Math.sin(deg * Math.PI / 180)}
              stroke="#FFD166" strokeWidth="3" strokeLinecap="round"
            />
          ))}
        </svg>
        {/* 구름 왼쪽 */}
        <svg className="absolute top-10 left-4 md:left-16 opacity-60" width="100" height="50" viewBox="0 0 100 50">
          <ellipse cx="50" cy="35" rx="40" ry="18" fill="white" />
          <ellipse cx="35" cy="28" rx="22" ry="16" fill="white" />
          <ellipse cx="62" cy="25" rx="20" ry="15" fill="white" />
        </svg>
        {/* 구름 오른쪽 */}
        <svg className="absolute top-32 right-1/4 opacity-40" width="70" height="35" viewBox="0 0 100 50">
          <ellipse cx="50" cy="35" rx="40" ry="18" fill="white" />
          <ellipse cx="35" cy="28" rx="22" ry="16" fill="white" />
          <ellipse cx="62" cy="25" rx="20" ry="15" fill="white" />
        </svg>
        {/* 물결 하단 */}
        <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none">
          <path d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z" fill="#faf9f7" />
        </svg>

        <div className="relative max-w-5xl mx-auto">
          <p className="text-[#296973] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            From the host · 신청서를 읽으며
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-3">
            호스트가 전하는 이야기
          </h2>
          <p className="text-gray-500 text-sm mb-12 max-w-lg">
            신청서에 담긴 부모님들의 걱정과 기대를 읽으며, 호스트가 떠올린 이야기들이에요.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {STORIES.map((s, i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-7 shadow-sm flex flex-col gap-4 border border-white"
                style={{ transform: `rotate(${[-1.2, 0.8, -0.5][i]}deg)` }}
              >
                <div className="flex justify-center -mt-3 mb-1">
                  <div className="w-3 h-3 rounded-full bg-[#ff6b35] shadow-sm" />
                </div>
                <span className="text-3xl">{s.emoji}</span>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {s.segments.map((seg, j) =>
                    seg.hi ? (
                      <span
                        key={j}
                        style={{
                          background: `linear-gradient(transparent 55%, ${s.color}88 45%)`,
                        }}
                      >
                        {seg.text}
                      </span>
                    ) : (
                      <span key={j}>{seg.text}</span>
                    )
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. 오시는 길 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            How to Get Here · 오시는 길
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-10">안동까지 오는 방법</h2>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <a
              href="https://www.letskorail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-3 bg-[#faf9f7] hover:bg-[#ff6b35]/5 border border-gray-100 hover:border-[#ff6b35]/30 rounded-2xl p-6 transition-all"
            >
              <span className="text-2xl">🚄</span>
              <div>
                <p className="font-semibold text-[#372a14] text-sm mb-0.5">KTX · 기차</p>
                <p className="text-xs text-gray-400 leading-relaxed">코레일 예매<br />→ 안동역 하차</p>
              </div>
              <p className="text-xs text-[#ff6b35] font-medium mt-auto group-hover:underline">letskorail.com →</p>
            </a>
            <a
              href="https://www.kobus.co.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-3 bg-[#faf9f7] hover:bg-[#296973]/5 border border-gray-100 hover:border-[#296973]/30 rounded-2xl p-6 transition-all"
            >
              <span className="text-2xl">🚌</span>
              <div>
                <p className="font-semibold text-[#372a14] text-sm mb-0.5">고속버스</p>
                <p className="text-xs text-gray-400 leading-relaxed">고속버스 예매<br />→ 안동버스터미널 하차</p>
              </div>
              <p className="text-xs text-[#296973] font-medium mt-auto group-hover:underline">kobus.co.kr →</p>
            </a>
            <a
              href="https://www.bustago.or.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-3 bg-[#faf9f7] hover:bg-[#372a14]/5 border border-gray-100 hover:border-[#372a14]/30 rounded-2xl p-6 transition-all"
            >
              <span className="text-2xl">🚍</span>
              <div>
                <p className="font-semibold text-[#372a14] text-sm mb-0.5">시외버스</p>
                <p className="text-xs text-gray-400 leading-relaxed">버스타고 앱·웹 예매<br />→ 안동버스터미널 하차</p>
              </div>
              <p className="text-xs text-[#372a14] font-medium mt-auto group-hover:underline">bustago.or.kr →</p>
            </a>
          </div>

          <div className="bg-[#faf9f7] rounded-2xl p-6 border border-gray-100 text-sm text-gray-600 leading-relaxed space-y-3">
            <p className="font-semibold text-[#372a14]">🚗 직접 데려다 주시는 경우</p>
            <p>
              부모님이 직접 안동까지 동행하시는 경우, <strong className="text-[#372a14]">1일차 오후 1시까지</strong> 코이노니아로 오시면 됩니다.
            </p>
            <div className="pt-1 border-t border-gray-200 space-y-1">
              <p className="text-xs text-gray-500">📍 <strong className="text-[#372a14]">경상북도 안동시 중앙로 57</strong></p>
              <p className="text-xs text-gray-400">주차 · 인근 웅부공영주차장 이용 (도보 1분)</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 10. FAQ ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            FAQ · 자주 묻는 질문
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-10">
            궁금한 점이 있으신가요?
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-[#faf9f7] transition-colors"
                >
                  <span className="text-sm font-semibold text-[#372a14] pr-4">{faq.q}</span>
                  <span className={`text-[#ff6b35] text-xl flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 border-t border-gray-100">
                    {faq.a.map((line, j) => (
                      <p key={j} className="text-sm text-gray-500 leading-relaxed mt-4">{line}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 bg-white rounded-2xl px-6 py-5 border border-gray-100 shadow-sm text-sm text-gray-500 leading-relaxed space-y-3">
            <p>
              궁금한 점은{" "}
              <a href="https://instagram.com/koinonia_andong" className="text-[#ff6b35] font-medium hover:underline">
                @koinonia_andong
              </a>
              {" "}혹은 안내 메세지 드린 연락처로 문의해 주세요.
            </p>
            <a
              href="https://pf.kakao.com/_DlDQn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#FEE500] text-[#3A1D1D] text-xs font-bold px-4 py-2.5 rounded-full hover:brightness-95 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M10 2C5.582 2 2 4.985 2 8.667c0 2.364 1.52 4.44 3.818 5.614L4.9 17.1a.4.4 0 0 0 .563.467l4.07-2.28c.154.012.31.18.467.018C14.418 15.305 18 12.348 18 8.667 18 4.985 14.418 2 10 2Z" fill="#3A1D1D"/>
              </svg>
              카카오톡 채널로 문의하기
            </a>
          </div>
        </div>
      </section>

      {/* ── 10-1. 이전 썸머캠프 둘러보기 ── */}
      <section className="py-20 md:py-28 px-6 md:px-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#296973] text-xs tracking-[0.35em] uppercase mb-3 font-medium">
            Previous Camp · 이전 캠프
          </p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-3">
            이전 썸머캠프 둘러보기
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-lg">
            이전 회차들이 어떻게 진행되었는지 직접 확인해 보세요.
          </p>
          <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-gray-400 mx-auto">koinonia-summer-camp.netlify.app</span>
            </div>
            <iframe
              src="https://koinonia-summer-camp.netlify.app/"
              className="w-full"
              style={{ height: "600px", border: "none" }}
              title="이전 썸머캠프"
              loading="lazy"
            />
          </div>
          <div className="mt-4 text-center">
            <a
              href="https://koinonia-summer-camp.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#296973] font-medium hover:underline"
            >
              새 탭에서 열기 →
            </a>
          </div>
        </div>
      </section>

      {/* ── 10. 신청 섹션 ── */}
      <section id="apply" className="py-20 md:py-28 px-6 md:px-16 bg-[#faf9f7]">
        <div className="max-w-2xl mx-auto">
          <p className="text-[#ff6b35] text-xs tracking-[0.35em] uppercase mb-3 font-medium">Apply · 참가 신청</p>
          <h2 className="text-2xl md:text-3xl font-light text-[#372a14] mb-3">참가 신청이 마감되었습니다</h2>
          <p className="text-gray-400 text-sm mb-5">모든 회차 신청이 완료되었어요. 희망 대기 신청은 가능합니다.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-8 text-sm text-amber-800 leading-relaxed">
            📋 대기 신청서를 작성해 주시면, 취소자 발생 시 희망 회차 순서대로 안내드립니다.
          </div>

          {/* 회차 선택 (대기 희망 회차) */}
          <p className="text-xs font-semibold text-[#372a14] mb-3">희망 회차 선택</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
            {SESSIONS.map((s) => {
              const isSelected = form.session === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setForm({ ...form, session: s.id })}
                  className={`relative rounded-2xl p-4 text-left border-2 transition-all
                    ${isSelected
                      ? "border-[#296973] bg-[#296973]/5"
                      : "border-gray-100 bg-white hover:border-[#296973]/40"
                    }`}
                >
                  <span className="absolute top-3 right-3 text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">마감</span>
                  <p className="text-xs text-[#296973] font-semibold tracking-wider mb-1">{s.round}</p>
                  <p className="text-sm text-[#372a14] font-medium leading-snug">{s.dates}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.days}</p>
                  {isSelected && (
                    <p className="text-[10px] text-[#296973] mt-2 font-semibold">대기 희망</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* 신청 완료 화면 */}
          {done ? (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">📋</div>
                <h3 className="text-xl font-bold text-[#372a14] mb-2">대기 신청 완료!</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {form.name}님, 대기 신청이 접수되었어요.<br />
                  취소자 발생 시 희망 회차 기준으로 순서대로 연락드립니다.
                </p>
              </div>

              <div className="bg-[#296973]/10 rounded-xl px-5 py-4 mb-6 text-sm text-[#296973] leading-relaxed">
                <p className="font-semibold mb-1">📌 안내</p>
                <p>자리가 생기면 남겨주신 연락처로 개별 연락드립니다. 별도 입금은 안내 이후 진행해 주세요.</p>
              </div>

              <div className="text-xs text-gray-400 space-y-1 text-center">
                <p>문의: 인스타그램 <a href="https://instagram.com/koinonia_andong" className="text-[#ff6b35] hover:underline">@koinonia_andong</a></p>
              </div>

              <Link
                href="/"
                className="block mt-6 text-center text-sm text-gray-400 hover:text-[#ff6b35] transition-colors"
              >
                ← 홈으로 돌아가기
              </Link>
            </div>
          ) : (
            /* 신청 폼 */
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">
              <h3 className="text-lg font-semibold text-[#372a14]">대기 신청서</h3>

              {/* 이름 + 연락처 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">
                    이름 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="홍길동"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">
                    연락처 (보호자) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                  />
                </div>
              </div>

              {/* 학년 + 거주지역 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">
                    학년 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors bg-white"
                  >
                    <option value="">선택해주세요</option>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">거주 지역</label>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder="서울 강남구"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                  />
                </div>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-xs font-medium text-[#372a14] mb-1">
                  이메일 <span className="text-gray-400 font-normal">(선택 — 신청 확인 메일 발송)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="hello@example.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                />
              </div>

              {/* 추천인 */}
              <div>
                <label className="block text-xs font-medium text-[#372a14] mb-1">추천인 (선택)</label>
                <input
                  type="text"
                  value={form.referral}
                  onChange={(e) => setForm({ ...form, referral: e.target.value })}
                  placeholder="추천해주신 분의 이름 또는 인스타그램 계정"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors"
                />
              </div>

              {/* 건강 & 케어 */}
              <div className="border-t border-gray-100 pt-5 space-y-4">
                <p className="text-xs font-semibold text-[#296973]">🩺 건강 & 케어 정보</p>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">음식 알레르기 여부</label>
                  <input
                    type="text"
                    value={form.allergy}
                    onChange={(e) => setForm({ ...form, allergy: e.target.value })}
                    placeholder="없으면 '없음', 있으면 구체적으로 적어주세요 (예: 견과류, 해산물)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#296973] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">캠프 중 신경써야 할 부분 (선택)</label>
                  <textarea
                    value={form.care}
                    onChange={(e) => setForm({ ...form, care: e.target.value })}
                    placeholder="수면 습관, 특정 공포, 건강 상태 등 호스트가 미리 알면 좋을 내용을 적어주세요."
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#296973] transition-colors resize-none"
                  />
                </div>
              </div>

              {/* 부모님 메시지 */}
              <div className="border-t border-gray-100 pt-5 space-y-4">
                <p className="text-xs font-semibold text-[#ff6b35]">💌 부모님 메시지</p>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">부모님의 고민 또는 기대감 (선택)</label>
                  <textarea
                    value={form.parentNote}
                    onChange={(e) => setForm({ ...form, parentNote: e.target.value })}
                    placeholder="자녀에 대해 호스트에게 미리 전하고 싶은 걱정이나 기대감을 자유롭게 남겨주세요."
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">궁금한 점 (선택)</label>
                  <textarea
                    value={form.question}
                    onChange={(e) => setForm({ ...form, question: e.target.value })}
                    placeholder="캠프에 대해 궁금한 점을 남겨주세요."
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#372a14] mb-1">요청사항 (선택)</label>
                  <textarea
                    value={form.memo}
                    onChange={(e) => setForm({ ...form, memo: e.target.value })}
                    placeholder="기타 요청사항이 있으면 자유롭게 적어주세요."
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#ff6b35] transition-colors resize-none"
                  />
                </div>
              </div>

              {/* 희망 회차 미선택 경고 */}
              {!form.session && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
                  ⚠️ 위에서 희망 대기 회차를 먼저 선택해주세요.
                </p>
              )}

              {error && (
                <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !form.session}
                className="w-full py-4 bg-[#ff6b35] text-white font-semibold rounded-xl hover:bg-[#e55a25] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {loading ? "신청 중..." : "대기 신청하기"}
              </button>

              <p className="text-xs text-gray-400 text-center leading-relaxed">
                입금 완료 후 1–2일 이내 호스트가 연락드립니다.<br />
                문의: <a href="https://instagram.com/koinonia_andong" className="text-[#ff6b35]">@koinonia_andong</a>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── 카카오톡 채널 플로팅 버튼 ── */}
      <a
        href="https://pf.kakao.com/_DlDQn"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#FEE500] text-[#3A1D1D] text-sm font-bold px-5 py-3.5 rounded-full shadow-lg hover:brightness-95 transition-all"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path fillRule="evenodd" clipRule="evenodd" d="M10 2C5.582 2 2 4.985 2 8.667c0 2.364 1.52 4.44 3.818 5.614L4.9 17.1a.4.4 0 0 0 .563.467l4.07-2.28c.154.012.31.18.467.018C14.418 15.305 18 12.348 18 8.667 18 4.985 14.418 2 10 2Z" fill="#3A1D1D"/>
        </svg>
        호스트에게 문의하기
      </a>

    </main>
  );
}
