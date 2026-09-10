export type ProgramType = "potluck" | "friday" | "special";

export type Program = {
  id: string;
  type: ProgramType;
  date: string;
  dateLabel: string;
  dates?: string[];
  title: string;
  subtitle?: string;
  price: number;
  capacity?: number;
};

export const PROGRAMS: Program[] = [
  // 수요 포틀럭
  {
    id: "p0902",
    type: "potluck",
    date: "2026-09-02",
    dateLabel: "9월 2일 (수) 19:00",
    title: "9월 생일자 파티 🎂",
    subtitle: "이달의 작가 '톨스토이' — 9월생들과 함께 먹고 축하하는 저녁",
    price: 10000,
  },
  {
    id: "p0909",
    type: "potluck",
    date: "2026-09-09",
    dateLabel: "9월 9일 (수) 19:00",
    title: "수요포틀럭 🍽️",
    subtitle: "",
    price: 10000,
  },
  {
    id: "p0916",
    type: "potluck",
    date: "2026-09-16",
    dateLabel: "9월 16일 (수) 19:00",
    title: "제철 과일 클럽 🍇",
    subtitle: "다품종 포도와 햇밀 빵으로 차리는 즉흥 과일 한 상",
    price: 20000,
  },
  {
    id: "p0923",
    type: "potluck",
    date: "2026-09-23",
    dateLabel: "9월 23일 (수) 19:00",
    title: "추석포틀럭: 명절오락관 🌕",
    subtitle: "명절 음식 한 상에 윷놀이까지 — 코이노니아식 추석 전야제",
    price: 10000,
  },
  {
    id: "p0930",
    type: "potluck",
    date: "2026-09-30",
    dateLabel: "9월 30일 (수) 19:00",
    title: "탈춤포틀럭 💃",
    subtitle: "축제 한복판에서 맞는 수요일, 먹고 마시고 탈춤판까지",
    price: 10000,
  },
  // 프라이데이나잇
  {
    id: "f0904",
    type: "friday",
    date: "2026-09-04",
    dateLabel: "9월 4일 (금) 20:00",
    title: "무비나잇 🎬",
    subtitle: "술 한잔과 함께 영화 한 편 보고 실컷 이야기합니다",
    price: 20000,
  },
  {
    id: "f0911",
    type: "friday",
    date: "2026-09-11",
    dateLabel: "9월 11일 (금) 20:00",
    title: "개강파티 🎒",
    subtitle: "새 학기의 피로를 핑계 삼아 같이 한잔하는 밤",
    price: 20000,
  },
  {
    id: "f0918",
    type: "friday",
    date: "2026-09-18",
    dateLabel: "9월 18일 (금) 20:00",
    title: "보드게임나잇 🎲",
    subtitle: "처음 본 사람과도 한 판 붙어보는 게임의 밤",
    price: 20000,
  },
  // Someday Salons
  {
    id: "s0912",
    type: "special",
    date: "2026-09-12",
    dateLabel: "9월 12일 (토) 20:00",
    title: "드렁큰 낭독회 📖",
    subtitle: "술 한 잔 곁에 두고 각자 좋아하는 문장을 소리 내어 읽는 밤",
    price: 10000,
  },
  {
    id: "s0915",
    type: "special",
    date: "2026-09-15",
    dateLabel: "9월 15일 · 22일 · 29일 (월) 20:00",
    dates: ["9월 15일 (월)", "9월 22일 (월)", "9월 29일 (월)"],
    title: "아이, 마이, 미, 마인 🎭",
    subtitle: "신청 시 5회차 전체 참가 / 세부 내용은 8/31(월) 저녁 공개 예정 / 문화놀이터 사업 (무료)",
    price: 0,
  },
];
