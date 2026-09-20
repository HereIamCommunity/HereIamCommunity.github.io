export type ProgramType =
  | "potluck"
  | "friday"
  | "special"
  | "talchum"        // 탈춤축제 — 날짜가 정해진 프로그램
  | "talchum-open";  // 탈춤축제 — 축제기간 상시, 신청자가 방문일을 고른다

export type Program = {
  id: string;
  type: ProgramType;
  date: string;
  dateLabel: string;
  dates?: string[];
  title: string;
  subtitle?: string;
  price: number;
  /**
   * 정원 — **'일시' 한 칸당** 인원. 시트 F열(일시)에 찍히는 값이 같은 신청끼리 센다.
   * 포틀럭처럼 같은 제목이 여러 날 열리면 날짜별로 따로 차고,
   * 슬롯이 있는 프로그램은 30분 칸마다 따로 찬다.
   */
  capacity?: number;
  /** 상시 프로그램: 신청 2단계에서 방문 날짜를 직접 고르게 한다. */
  pickDate?: boolean;
  /** 카드에 함께 띄울 준비물·비고 한 줄. */
  note?: string;
  /** 정원이 시간대 단위일 때(예: 30분마다 2명) 시간을 쪼개는 규칙. */
  slots?: SlotConfig;
};

/** 상시 프로그램을 일정 간격으로 쪼갠다. 14:00–18:00 을 30분씩 → 8칸. */
export type SlotConfig = {
  start: string;   // "14:00"
  end: string;     // "18:00"
  minutes: number; // 30
};

export type Slot = { value: string; label: string };

/** SlotConfig → [{ value: "14:00", label: "14:00–14:30" }, ...] */
export function buildSlots(cfg: SlotConfig): Slot[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const fmt = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

  const out: Slot[] = [];
  for (let t = toMin(cfg.start); t + cfg.minutes <= toMin(cfg.end); t += cfg.minutes) {
    out.push({ value: fmt(t), label: `${fmt(t)}–${fmt(t + cfg.minutes)}` });
  }
  return out;
}

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

/* ──────────────────────────────────────────────────────────────
 * 2026 안동국제탈춤페스티벌 (9/24–10/4) — 코이노니아 프로그램
 *
 * 신청은 살롱과 같은 경로를 탄다: /api/booking 에 type:"salon" 으로 넣어
 * 구글 시트 '살롱' 탭·알림톡·어드민을 그대로 쓴다. 그래서 title 은
 * 시트에 그대로 찍히는 값이다 — 바꾸면 이미 쌓인 행과 어긋난다.
 *
 * subtitle·note 는 카드뉴스 문구를 그대로 옮긴 것이다. 원문이 바뀌지 않는 한
 * 고쳐 쓰지 않는다.
 * ────────────────────────────────────────────────────────────── */

/** 축제 기간. 상시 프로그램의 방문일 선택지를 이 범위에서 만든다. */
export const FESTIVAL_START = "2026-09-24";
export const FESTIVAL_END = "2026-10-04";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-09-24" → "9월 24일 (목)" */
export function festivalDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAY[d.getUTCDay()]})`;
}

/** 휴무일 — 카드뉴스 캘린더의 "29 휴무". 상시 프로그램 선택지에서 뺀다. */
export const FESTIVAL_CLOSED_DAYS = ["2026-09-29"];

/** 축제 기간 중 문을 여는 날짜 (ISO) */
export const FESTIVAL_DAYS: string[] = (() => {
  const out: string[] = [];
  const end = new Date(`${FESTIVAL_END}T00:00:00Z`);
  for (const d = new Date(`${FESTIVAL_START}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (!FESTIVAL_CLOSED_DAYS.includes(iso)) out.push(iso);
  }
  return out;
})();

const POTLUCK_SUBTITLE = "1인분의 음식을 가지고 둘러앉아 음식과 이야기를 나눕니다.";
const POTLUCK_NOTE = "준비물 : 각자 1인분 음식";
const DRINK_NOTE = "예약 : 5,000원 (음료 제공) / 워크인 : 음료 주문 필수";
const MEDITATION_SUBTITLE =
  "둥글게 둘러 앉아 소리와 공명하고, 샌드만다라를 함께 그리고 지웁니다.";

export const TALCHUM_PROGRAMS: Program[] = [
  // ── 포틀럭 파티 · 7:00-8:30 pm ──
  {
    id: "t0926-potluck",
    type: "talchum",
    date: "2026-09-26",
    dateLabel: "9월 26일 (토) 19:00–20:30",
    title: "포틀럭 파티 🍽️",
    subtitle: POTLUCK_SUBTITLE,
    note: POTLUCK_NOTE,
    price: 10000,
    capacity: 12,
  },
  {
    id: "t0927-potluck",
    type: "talchum",
    date: "2026-09-27",
    dateLabel: "9월 27일 (일) 19:00–20:30",
    title: "포틀럭 파티 🍽️",
    subtitle: POTLUCK_SUBTITLE,
    note: POTLUCK_NOTE,
    price: 10000,
    capacity: 12,
  },
  {
    id: "t0930-potluck",
    type: "talchum",
    date: "2026-09-30",
    dateLabel: "9월 30일 (수) 19:00–20:30",
    title: "포틀럭 파티 🍽️",
    subtitle: POTLUCK_SUBTITLE,
    note: POTLUCK_NOTE,
    price: 10000,
    capacity: 12,
  },
  {
    id: "t1001-potluck",
    type: "talchum",
    date: "2026-10-01",
    dateLabel: "10월 1일 (목) 19:00–20:30",
    title: "포틀럭 파티 🍽️",
    subtitle: POTLUCK_SUBTITLE,
    note: POTLUCK_NOTE,
    price: 10000,
    capacity: 12,
  },
  {
    id: "t1002-potluck",
    type: "talchum",
    date: "2026-10-02",
    dateLabel: "10월 2일 (금) 19:00–20:30",
    title: "포틀럭 파티 🍽️",
    subtitle: POTLUCK_SUBTITLE,
    note: POTLUCK_NOTE,
    price: 10000,
    capacity: 12,
  },

  // ── 날짜가 정해진 나머지 프로그램 ──
  {
    id: "t0925-movie",
    type: "talchum",
    date: "2026-09-25",
    dateLabel: "9월 25일 (금) 21:00–03:00",
    title: "무비올나잇 🎬",
    subtitle: "코이노니아에서 분위기 좋은 영화 틀어놓고 와인 마시며 옆사람과 필담을 나눠요!",
    price: 20000,
    capacity: 20,
  },
  {
    id: "t0926-meditation",
    type: "talchum",
    date: "2026-09-26",
    dateLabel: "9월 26일 (토) 08:00–09:30",
    title: "명상 & 샌드아트 🪷",
    subtitle: MEDITATION_SUBTITLE,
    note: "with 재철",
    price: 20000,
    capacity: 14,
  },
  {
    id: "t0927-run",
    type: "talchum",
    date: "2026-09-27",
    dateLabel: "9월 27일 (일) 21:00–22:00",
    title: "탈춤런 🏃",
    subtitle: "경보부터 10km 런까지 각 그룹의 페이스에 맞춰 죄책감 털기런을 진행합니다.",
    note: "with 하영",
    price: 10000,
    capacity: 12,
  },
  {
    id: "t0928-contactjam",
    type: "talchum",
    date: "2026-09-28",
    dateLabel: "9월 28일 (월) 19:30–21:00",
    title: "컨택 잼 워크숍 💫",
    subtitle: "몸과 몸의 부딪힘 속에서 자연스럽게 연결되는 춤사위를 경험합니다.",
    note: "with 바리 / 준비물 : 편안한 복장",
    price: 30000,
    capacity: 16,
  },
  {
    id: "t1001-dj",
    type: "talchum",
    date: "2026-10-01",
    dateLabel: "10월 1일 (목) 20:00–22:00",
    title: "DJ 레이브 🎧",
    subtitle: "탈춤 축제에서 춤이 빠질 수 없어서 만든 이벤트, DJ 레이브에 맞춰 춤추자!",
    note: DRINK_NOTE,
    price: 5000,
    capacity: 30,
  },
  {
    id: "t1003-meditation",
    type: "talchum",
    date: "2026-10-03",
    dateLabel: "10월 3일 (토) 08:00–09:30",
    title: "명상 & 샌드아트 🪷",
    subtitle: MEDITATION_SUBTITLE,
    note: "with 재철",
    price: 20000,
    capacity: 14,
  },

  // ── 상시 프로그램 — 신청 시 방문 날짜를 고른다 ──
  // 탈꾸미기·캐리커쳐는 워크인이라 신청을 받지 않는다(페이지에는 소개만 있다).
  {
    id: "t-open-talk",
    type: "talchum-open",
    date: FESTIVAL_END,
    dateLabel: "축제기간 상시 · 14:00–18:00",
    title: "스치는 대화 ☕",
    subtitle: "이름도 직업도 묻지 않고 요즘 좋아하는 것, 최근의 마음, 살아가는 이야기를 나눠요.",
    note: DRINK_NOTE,
    price: 5000,
    pickDate: true,
    slots: { start: "14:00", end: "18:00", minutes: 30 },
    capacity: 2,
  },
];

/**
 * 정원 집계 키 — 프로그램명 + 일시.
 * 시트 E열(프로그램)·F열(일시) 조합이며, `capacity` 는 이 키 하나당 인원이다.
 * 같은 제목이 여러 날 열려도 날짜별로, 슬롯이 있으면 슬롯별로 따로 센다.
 */
export function countKey(program: string, date: string): string {
  return `${(program ?? "").trim()}|||${(date ?? "").trim()}`;
}

/**
 * 접수 전 마감 확인 — 그 '프로그램 + 일시' 칸이 정원을 채웠는지.
 * `counts`는 `getSalonCounts()`가 돌려주는 집계다. 정원이 없는 프로그램은 늘 false.
 */
export function isBookingFull(
  program: string,
  date: string,
  counts: Record<string, number>
): boolean {
  const p = [...PROGRAMS, ...TALCHUM_PROGRAMS].find(
    (x) => x.title === program && x.capacity
  );
  if (!p?.capacity) return false;
  return (counts[countKey(program, date)] ?? 0) >= p.capacity;
}

/** 달력 한 칸 — 축제 기간의 하루. */
export type FestivalDay = {
  iso: string;          // "2026-09-24"
  day: number;          // 24
  weekday: number;      // 0=일 … 6=토
  closed: boolean;      // 휴무
};

/**
 * 신청 달력에 그릴 날짜들 — 축제 기간을 월~일 주 단위로 채운 2차원 배열.
 * 기간 밖 칸은 null 로 비워 둔다.
 */
export function festivalCalendar(): (FestivalDay | null)[][] {
  const start = new Date(`${FESTIVAL_START}T00:00:00Z`);
  const end = new Date(`${FESTIVAL_END}T00:00:00Z`);

  // 월요일 시작으로 맞춘다 (일요일=0 → 6번째 칸)
  const lead = (start.getUTCDay() + 6) % 7;
  const cells: (FestivalDay | null)[] = Array(lead).fill(null);

  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    cells.push({
      iso,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
      closed: FESTIVAL_CLOSED_DAYS.includes(iso),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (FestivalDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 그 날 신청할 수 있는 프로그램 — 상시 프로그램은 휴무가 아닌 모든 날에 열린다. */
export function programsOnDay(programs: Program[], iso: string): Program[] {
  if (FESTIVAL_CLOSED_DAYS.includes(iso)) return [];
  return programs.filter((p) => (p.pickDate ? true : p.date === iso));
}
