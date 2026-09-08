import { describe, it, expect, afterEach, vi } from "vitest";
import {
  normalizeDate,
  parseSheetDateTime,
  kstToday,
  buildDigest,
  isConfirmed,
  isPending,
  ageDays,
} from "@/lib/digest";

/* ─── 픽스처 ─────────────────────────────────
   예약 A~O: 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수
             8체크인 9체크아웃 10할인 11금액 12요청사항 13상태 14알림
─────────────────────────────────────────── */
const BOOKING_HEADER = [
  "신청일시","구분","이름","연락처","프로그램","일시","객실","박수",
  "체크인","체크아웃","할인","결제금액","요청사항","상태","알림",
];

const b = (o: Partial<Record<number, string>>): string[] => {
  const row = new Array(15).fill("");
  for (const [k, v] of Object.entries(o)) row[Number(k)] = v;
  return row;
};

// 오래된 살롱 입금대기 (상태 빈값) · 오늘 살롱
const salonOld = b({
  0: "2026. 9. 3. 오후 7:10:32", 1: "살롱", 2: "김오래", 3: "010-1111-1111",
  4: "목요살롱", 5: "9월 7일 (월) 19:00", 11: "30,000", 13: "",
});
// 살롱 입금대기 (상태 "신청") · 오늘 아님
const salonMid = b({
  0: "2026. 9. 5. 오전 10:00:00", 1: "살롱", 2: "박중간", 3: "010-2222-2222",
  4: "금요살롱", 5: "9월 20일 (일) 20:00", 11: "20,000", 13: "신청",
});
// 어제 신규 · 입금대기 · 오늘 살롱(ISO 형식)
const salonNew = b({
  0: "2026. 9. 6. 오전 9:00:00", 1: "살롱", 2: "이신규", 3: "010-3333-3333",
  4: "토요살롱", 5: "2026-09-07 20:00", 11: "10,000", 13: "신청",
});
// 오늘 체크인 · 입금확인 · 이번 달 신청
const stayIn = b({
  0: "2026. 9. 6. 오후 1:00:00", 1: "스테이", 2: "최체크인", 3: "010-4444-4444",
  6: "나그네방", 7: "2", 8: "2026. 9. 7.", 9: "2026. 9. 9.", 11: "120,000", 13: "입금확인",
});
// 오늘 체크아웃 · 결제완료 · 이번 달 신청
const stayOut = b({
  0: "2026. 9. 1. 오전 8:00:00", 1: "스테이", 2: "정체크아웃", 3: "010-5555-5555",
  6: "옥순방", 7: "2", 8: "2026-09-05", 9: "2026-09-07", 11: "80,000", 13: "결제완료",
});
// 오늘 체크인이지만 취소 → 어디에도 안 들어감
const stayCancelled = b({
  0: "2026. 9. 6. 오후 3:00:00", 1: "스테이", 2: "취소된이", 3: "010-6666-6666",
  6: "여태방", 8: "2026-09-07", 9: "2026-09-08", 11: "90,000", 13: "취소",
});
// 어제 신청했지만 취소 → newYesterday 제외
const cancelledYesterday = b({
  0: "2026. 9. 6. 오후 5:00:00", 1: "살롱", 2: "어제취소", 3: "010-7777-7777",
  4: "목요살롱", 5: "9월 30일 (수) 19:00", 11: "30,000", 13: "취소",
});
// 지난달 입금확인 → month 집계 제외
const lastMonth = b({
  0: "2026. 8. 20. 오전 9:00:00", 1: "살롱", 2: "지난달", 3: "010-8888-8888",
  4: "목요살롱", 5: "8월 20일 (목) 19:00", 11: "50,000", 13: "입금확인",
});

const BOOKINGS = [
  BOOKING_HEADER,
  salonOld, salonMid, salonNew, stayIn, stayOut, stayCancelled, cancelledYesterday, lastMonth,
];

// 리트릿 A~M: 0신청일시 1이름 2연락처 ... 5회차 ... 12상태
const RETREAT_HEADER = [
  "신청일시","이름","연락처","학년나이","거주지역","회차","추천인","궁금한점",
  "요청사항","알레르기","케어사항","부모님메모","상태",
];
const r = (createdAt: string, name: string, session: string, status: string) => [
  createdAt, name, "010-9999-0000", "중2", "안동", session, "", "", "", "", "", "", status,
];
const RETREATS = [
  RETREAT_HEADER,
  r("2026. 9. 1. 오전 9:00:00", "리트릿1", "1회차 7/3-5", "신청"),
  r("2026. 9. 2. 오전 9:00:00", "리트릿취소", "1회차 7/3-5", "취소"),
  r("2026. 9. 6. 오전 9:00:00", "리트릿2", "2회차 7/24-26", "신청"),
];

// 고정 now — 로컬 필드가 KST 벽시계(2026-09-07 09:00, 월요일)
const NOW = new Date(2026, 8, 7, 9, 0, 0);

afterEach(() => {
  vi.useRealTimers();
});

describe("normalizeDate", () => {
  it("점 구분 한국식 날짜를 ISO로 바꾼다", () => {
    expect(normalizeDate("2026. 9. 6.")).toBe("2026-09-06");
  });

  it("이미 ISO면 그대로 둔다", () => {
    expect(normalizeDate("2026-09-06")).toBe("2026-09-06");
  });

  it("슬래시 구분도 ISO로 바꾼다", () => {
    expect(normalizeDate("2026/9/6")).toBe("2026-09-06");
  });

  it("ISO 뒤에 시각이 붙어도 날짜만 뽑는다", () => {
    expect(normalizeDate("2026-09-10 19:00")).toBe("2026-09-10");
  });

  it("빈 문자열은 빈 문자열", () => {
    expect(normalizeDate("")).toBe("");
  });

  it("날짜가 없으면 원문 그대로", () => {
    expect(normalizeDate("미정")).toBe("미정");
  });
});

describe("parseSheetDateTime", () => {
  it("오후 7:10:32를 19시로 읽는다", () => {
    const d = parseSheetDateTime("2026. 9. 6. 오후 7:10:32")!;
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 6]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([19, 10, 32]);
  });

  it("오전 12:05:00은 00:05로 읽는다", () => {
    const d = parseSheetDateTime("2026. 9. 6. 오전 12:05:00")!;
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 5]);
  });

  it("오후 12:30:00은 12:30 그대로", () => {
    const d = parseSheetDateTime("2026. 9. 6. 오후 12:30:00")!;
    expect(d.getHours()).toBe(12);
  });

  it("형식이 안 맞으면 null", () => {
    expect(parseSheetDateTime("2026-09-06")).toBeNull();
    expect(parseSheetDateTime("")).toBeNull();
  });
});

describe("kstToday", () => {
  it("UTC 15:30은 KST로 다음 날이다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T15:30:00Z"));
    expect(kstToday()).toBe("2026-09-07");
  });

  it("offset -1이면 어제", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T15:30:00Z"));
    expect(kstToday(-1)).toBe("2026-09-06");
  });

  it("offset +1이면 내일", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T15:30:00Z"));
    expect(kstToday(1)).toBe("2026-09-08");
  });
});

describe("isConfirmed / isPending", () => {
  it("입금확인·결제완료·확정은 확정", () => {
    expect(isConfirmed("입금확인")).toBe(true);
    expect(isConfirmed("결제완료")).toBe(true);
    expect(isConfirmed("확정")).toBe(true);
  });

  it("신청·빈값·취소는 확정이 아니다", () => {
    expect(isConfirmed("신청")).toBe(false);
    expect(isConfirmed("")).toBe(false);
    expect(isConfirmed("취소")).toBe(false);
  });

  it("빈값과 신청은 입금대기", () => {
    expect(isPending("")).toBe(true);
    expect(isPending("신청")).toBe(true);
  });

  it("입금확인·취소는 입금대기가 아니다", () => {
    expect(isPending("입금확인")).toBe(false);
    expect(isPending("취소")).toBe(false);
  });

  it("앞뒤 공백은 무시한다", () => {
    expect(isConfirmed(" 입금확인 ")).toBe(true);
    expect(isPending("  ")).toBe(true);
  });
});

describe("ageDays", () => {
  it("이틀 전 신청은 2", () => {
    expect(ageDays("2026. 9. 5. 오후 7:10:32", NOW)).toBe(2);
  });

  it("오늘 신청은 0", () => {
    expect(ageDays("2026. 9. 7. 오전 1:00:00", NOW)).toBe(0);
  });

  it("파싱 못 하면 0", () => {
    expect(ageDays("", NOW)).toBe(0);
  });
});

describe("buildDigest", () => {
  const d = buildDigest(BOOKINGS, RETREATS, NOW);

  it("오늘 날짜를 KST ISO로 준다", () => {
    expect(d.today).toBe("2026-09-07");
  });

  it("헤더 행은 결과에 섞이지 않는다", () => {
    const all = [...d.pending, ...d.checkIns, ...d.checkOuts, ...d.salonToday, ...d.newYesterday];
    expect(all.some((row) => row[0] === "신청일시")).toBe(false);
  });

  it("입금대기는 신청일시 오름차순(오래된 순)", () => {
    expect(d.pending.map((row) => row[2])).toEqual(["김오래", "박중간", "이신규"]);
  });

  it("오늘 체크인은 취소를 뺀 스테이만", () => {
    expect(d.checkIns.map((row) => row[2])).toEqual(["최체크인"]);
  });

  it("오늘 체크아웃은 취소를 뺀 스테이만", () => {
    expect(d.checkOuts.map((row) => row[2])).toEqual(["정체크아웃"]);
  });

  it("오늘 살롱은 '9월 7일' 표기와 ISO 표기를 모두 잡는다", () => {
    expect(d.salonToday.map((row) => row[2])).toEqual(["김오래", "이신규"]);
  });

  it("어제 신규는 취소를 뺀 어제 신청분", () => {
    expect(d.newYesterday.map((row) => row[2])).toEqual(["이신규", "최체크인"]);
  });

  it("이번 달 확정 건수·금액은 입금확인+결제완료만 센다", () => {
    expect(d.month).toEqual({ confirmedCount: 2, confirmedAmount: 200000 });
  });

  it("리트릿 회차 카운트는 취소를 뺀다", () => {
    expect(d.retreatCounts).toEqual({ s1: 1, s2: 1, s3: 0, s4: 0, s5: 0 });
  });

  it("빈 배열을 줘도 터지지 않는다", () => {
    const empty = buildDigest([], [], NOW);
    expect(empty.pending).toEqual([]);
    expect(empty.month).toEqual({ confirmedCount: 0, confirmedAmount: 0 });
    expect(empty.retreatCounts).toEqual({ s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 });
  });

  it("now를 안 주면 현재 KST 날짜를 쓴다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T15:30:00Z"));
    expect(buildDigest([], []).today).toBe("2026-09-07");
  });
});

describe("RETREAT_SESSIONS", () => {
  it("키와 라벨이 시트에 적히는 회차 표기와 같다", async () => {
    const { RETREAT_SESSIONS } = await import("@/lib/retreat-sessions");
    expect(RETREAT_SESSIONS.map((s) => `${s.key} ${s.label}`)).toEqual([
      "s1 1회차 7/3-5",
      "s2 2회차 7/24-26",
      "s3 3회차 7/30-8/1",
      "s4 4회차 8/15-17",
      "s5 5회차 8/21-23",
    ]);
  });

  it("회차마다 ISO 시작·종료일이 있다", async () => {
    const { RETREAT_SESSIONS } = await import("@/lib/retreat-sessions");
    for (const s of RETREAT_SESSIONS) {
      expect(s.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.start <= s.end).toBe(true);
    }
  });
});

describe("buildDigest · 신청일시가 빈 행", () => {
  const header = ["신청일시", "구분", "이름"];
  const rows = [
    header,
    ["", "스테이", "빈행A", "", "", "", "여태방", "3", "2026-09-04", "2026-09-07"],
    ["2026. 9. 6. 오전 10:00:00", "살롱", "김최근", "010"],
    ["2026. 9. 1. 오전 10:00:00", "살롱", "박오래", "010"],
    ["", "스테이", "빈행B", "", "", "", "여태방", "1", "2026-09-10", "2026-09-11"],
  ];

  it("신청일시를 못 읽는 행은 입금대기 목록 맨 뒤로 간다", () => {
    const d = buildDigest(rows, [], new Date(2026, 8, 7, 9, 0));
    expect(d.pending.map((r) => r[2])).toEqual(["박오래", "김최근", "빈행A", "빈행B"]);
  });
});
