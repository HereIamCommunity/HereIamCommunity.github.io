import { describe, it, expect } from "vitest";
import { buildStats } from "@/lib/stats";
import { buildDigest } from "@/lib/digest";

/* ─── 픽스처 ─────────────────────────────────
   예약 A~O: 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수
             8체크인 9체크아웃 10할인 11결제금액 12요청사항 13상태 14알림
─────────────────────────────────────────── */
const HEADER = [
  "신청일시","구분","이름","연락처","프로그램","일시","객실","박수",
  "체크인","체크아웃","할인","결제금액","요청사항","상태","알림",
];

const GEOT = "멤버십 곁 (-20%)";
const NAGNAE = "나그네방 후원자 (-30%)";
const NONE = "없음";

const salon = (
  createdAt: string, name: string, program: string,
  discount: string, amount: string, status: string
): string[] => [
  createdAt, "살롱", name, "010-0000-0000", program, "", "", "",
  "", "", discount, amount, "", status, "",
];

const stay = (
  createdAt: string, name: string, room: string, nights: string,
  discount: string, amount: string, status: string
): string[] => [
  createdAt, "스테이", name, "010-0000-0000", "", "", room, nights,
  "", "", discount, amount, "", status, "",
];

// 고정 now — 로컬 필드가 KST 벽시계(2026-09-07 09:00)
const NOW = new Date(2026, 8, 7, 9, 0, 0);

const ROWS = [
  // ── 이번 달 (2026-09) ──
  salon("2026. 9. 7. 오전 9:00:00", "A", "목요살롱", NONE, "30,000", "입금확인"),
  salon("2026. 9. 7. 오후 7:10:32", "B", "목요살롱", GEOT, "24,000", "결제완료"),
  salon("2026. 9. 6. 오전 10:00:00", "C", "금요살롱", NAGNAE, "21,000", "신청"),
  stay("2026. 9. 6. 오후 2:00:00", "D", "나그네방", "2", NONE, "120,000", "입금확인"),
  stay("2026. 9. 5. 오전 11:00:00", "E", "옥순방", "3", GEOT, "150,000", "결제완료"),
  salon("2026. 9. 3. 오전 11:00:00", "F", "목요살롱", NONE, "30,000", "취소"),
  // ── 지난 달 (2026-08) ──
  salon("2026. 8. 20. 오전 9:00:00", "G", "목요살롱", NONE, "30,000", "입금확인"),
  stay("2026. 8. 21. 오전 9:00:00", "H", "나그네방", "1", NONE, "60,000", "입금확인"),
  salon("2026. 8. 22. 오전 9:00:00", "I", "금요살롱", NONE, "20,000", "신청"),
  // ── 올해 앞쪽 (2026-01) ──
  salon("2026. 1. 10. 오전 9:00:00", "J", "필사살롱", NONE, "10,000", "입금확인"),
  // ── 전년 동월 (2025-09) ──
  salon("2025. 9. 7. 오전 9:00:00", "K", "목요살롱", NONE, "30,000", "입금확인"),
  stay("2025. 9. 8. 오전 9:00:00", "L", "여태방", "2", NAGNAE, "100,000", "결제완료"),
  // ── 작년 (2025-03) ──
  salon("2025. 3. 3. 오전 9:00:00", "M", "목요살롱", NONE, "15,000", "입금확인"),
  // ── 재작년 (2024-05) ──
  stay("2024. 5. 5. 오전 9:00:00", "N", "옥순방", "1", NONE, "50,000", "입금확인"),
  // ── 신청일시를 못 읽는 행 → 어느 버킷에도 안 들어간다 ──
  salon("", "O", "목요살롱", NONE, "999,999", "입금확인"),
];

const BOOKINGS = [HEADER, ...ROWS];
const s = buildStats(BOOKINGS, NOW);

const bucket = <T extends { key: string }>(list: T[], key: string): T =>
  list.find((x) => x.key === key)!;

describe("buildStats · daily", () => {
  it("최근 30일을 오래된 순으로 채운다", () => {
    expect(s.daily).toHaveLength(30);
    expect(s.daily[0].key).toBe("2026-08-09");
    expect(s.daily[29].key).toBe("2026-09-07");
  });

  it("데이터 없는 날도 0으로 채운다", () => {
    expect(s.daily[0]).toMatchObject({
      salonCount: 0, stayCount: 0, salonAmount: 0, stayAmount: 0, requested: 0,
    });
  });

  it("오늘 살롱 확정 2건이 잡힌다", () => {
    expect(bucket(s.daily, "2026-09-07")).toMatchObject({
      salonCount: 2, salonAmount: 54000, stayCount: 0, stayAmount: 0, requested: 2,
    });
  });

  it("확정 아닌 신청도 requested에는 들어간다", () => {
    // 9/6: 살롱 '신청' 1건 + 스테이 '입금확인' 1건
    expect(bucket(s.daily, "2026-09-06")).toMatchObject({
      salonCount: 0, stayCount: 1, stayAmount: 120000, requested: 2,
    });
  });

  it("취소 건은 requested에서도 빠진다", () => {
    expect(bucket(s.daily, "2026-09-03")).toMatchObject({
      salonCount: 0, stayCount: 0, requested: 0,
    });
  });

  it("일별 라벨은 M/D", () => {
    expect(bucket(s.daily, "2026-09-07").label).toBe("9/7");
    expect(s.daily[0].label).toBe("8/9");
  });
});

describe("buildStats · monthly", () => {
  it("최근 12개월을 오래된 순으로 채운다", () => {
    expect(s.monthly).toHaveLength(12);
    expect(s.monthly[0].key).toBe("2025-10");
    expect(s.monthly[11].key).toBe("2026-09");
  });

  it("12개월 창 밖(2025-09)은 들어오지 않는다", () => {
    expect(s.monthly.some((m) => m.key === "2025-09")).toBe(false);
  });

  it("빈 달은 0", () => {
    expect(bucket(s.monthly, "2025-11")).toMatchObject({
      salonCount: 0, stayCount: 0, requested: 0,
    });
  });

  it("이번 달은 확정 4건·324,000원, 신청 5건", () => {
    expect(bucket(s.monthly, "2026-09")).toMatchObject({
      salonCount: 2, salonAmount: 54000,
      stayCount: 2, stayAmount: 270000,
      requested: 5,
    });
  });

  it("월 라벨은 'M월', 연도가 바뀌는 자리와 첫 칸은 'YYYY년 M월'", () => {
    expect(s.monthly[0].label).toBe("2025년 10월");
    expect(bucket(s.monthly, "2025-11").label).toBe("11월");
    expect(bucket(s.monthly, "2026-01").label).toBe("2026년 1월");
    expect(bucket(s.monthly, "2026-09").label).toBe("9월");
  });
});

describe("buildStats · yearly", () => {
  it("데이터가 있는 연도를 오름차순으로 준다", () => {
    expect(s.yearly.map((y) => y.key)).toEqual(["2024", "2025", "2026"]);
  });

  it("연도 라벨은 'YYYY년'", () => {
    expect(s.yearly.map((y) => y.label)).toEqual(["2024년", "2025년", "2026년"]);
  });

  it("연도별 합계가 맞는다", () => {
    expect(bucket(s.yearly, "2024")).toMatchObject({
      salonCount: 0, stayCount: 1, stayAmount: 50000, requested: 1,
    });
    expect(bucket(s.yearly, "2025")).toMatchObject({
      salonCount: 2, salonAmount: 45000, stayCount: 1, stayAmount: 100000, requested: 3,
    });
    expect(bucket(s.yearly, "2026")).toMatchObject({
      salonCount: 4, salonAmount: 94000, stayCount: 3, stayAmount: 330000, requested: 9,
    });
  });

  it("신청일시를 못 읽는 행은 어느 버킷에도 안 들어간다", () => {
    const total = s.yearly.reduce((n, y) => n + y.salonCount + y.stayCount, 0);
    expect(total).toBe(11); // 확정 12건 중 신청일시 불명 1건 제외
  });
});

describe("buildStats · compare", () => {
  it("이번 달 vs 지난 달 건수", () => {
    expect(s.compare.monthCount).toEqual({
      label: "이번 달 vs 지난 달", current: 4, previous: 2, diff: 2, pct: 100, unit: "건",
    });
  });

  it("이번 달 vs 지난 달 금액", () => {
    expect(s.compare.monthAmount).toEqual({
      label: "이번 달 vs 지난 달", current: 324000, previous: 90000, diff: 234000, pct: 260, unit: "원",
    });
  });

  it("올해 vs 작년", () => {
    expect(s.compare.yearCount).toMatchObject({
      label: "올해 vs 작년", current: 7, previous: 3, diff: 4, pct: 133.3, unit: "건",
    });
    expect(s.compare.yearAmount).toMatchObject({
      current: 424000, previous: 145000, diff: 279000, pct: 192.4, unit: "원",
    });
  });

  it("전년 동월 대비", () => {
    expect(s.compare.yoyMonthCount).toMatchObject({
      label: "전년 동월 대비", current: 4, previous: 2, diff: 2, pct: 100, unit: "건",
    });
    expect(s.compare.yoyMonthAmount).toMatchObject({
      current: 324000, previous: 130000, diff: 194000, pct: 149.2, unit: "원",
    });
  });

  it("이전 값이 0이면 pct는 null", () => {
    const only = buildStats(
      [HEADER, salon("2026. 9. 7. 오전 9:00:00", "A", "목요살롱", NONE, "30,000", "입금확인")],
      NOW
    );
    expect(only.compare.monthCount.previous).toBe(0);
    expect(only.compare.monthCount.pct).toBeNull();
    expect(only.compare.monthCount.diff).toBe(1);
    expect(only.compare.yoyMonthAmount.pct).toBeNull();
  });
});

describe("buildStats · byProgram", () => {
  it("살롱 확정만 프로그램별로 세고 건수 내림차순", () => {
    expect(s.byProgram).toEqual([
      { name: "목요살롱", count: 5, amount: 129000 },
      { name: "필사살롱", count: 1, amount: 10000 },
    ]);
  });

  it("상위 10개까지만 준다", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      Array.from({ length: 12 - i }, () =>
        salon("2026. 9. 2. 오전 9:00:00", "X", `프로그램${i}`, NONE, "1,000", "입금확인")
      )
    ).flat();
    const r = buildStats([HEADER, ...many], NOW);
    expect(r.byProgram).toHaveLength(10);
    expect(r.byProgram[0]).toEqual({ name: "프로그램0", count: 12, amount: 12000 });
    expect(r.byProgram[9].name).toBe("프로그램9");
  });
});

describe("buildStats · byRoom", () => {
  it("스테이 확정의 박수를 객실별로 합산한다", () => {
    expect(s.byRoom).toEqual([
      { room: "옥순방", nights: 4, count: 2, amount: 200000 },
      { room: "나그네방", nights: 3, count: 2, amount: 180000 },
      { room: "여태방", nights: 2, count: 1, amount: 100000 },
    ]);
  });
});

describe("buildStats · discount / basis", () => {
  it("확정 건 기준으로 할인 종류를 센다", () => {
    expect(s.discount).toEqual({ none: 8, geot: 2, nagnae: 1 });
  });

  it("집계 기준을 그대로 알려준다", () => {
    expect(s.basis).toEqual({
      confirmedStatuses: ["입금확인", "결제완료"],
      excludes: ["취소"],
    });
  });
});

describe("buildStats · 빈 입력", () => {
  it("헤더만 있어도 터지지 않는다", () => {
    const empty = buildStats([HEADER], NOW);
    expect(empty.daily).toHaveLength(30);
    expect(empty.monthly).toHaveLength(12);
    expect(empty.yearly).toEqual([]);
    expect(empty.byProgram).toEqual([]);
    expect(empty.byRoom).toEqual([]);
    expect(empty.discount).toEqual({ none: 0, geot: 0, nagnae: 0 });
    expect(empty.compare.monthCount).toMatchObject({ current: 0, previous: 0, diff: 0, pct: null });
  });

  it("빈 배열도 안전하다", () => {
    expect(buildStats([], NOW).yearly).toEqual([]);
  });
});

describe("digest와 통계의 이번 달 확정 수치는 같다", () => {
  it("confirmedCount === compare.monthCount.current", () => {
    const d = buildDigest(BOOKINGS, [], NOW);
    expect(d.month.confirmedCount).toBe(s.compare.monthCount.current);
  });

  it("confirmedAmount === compare.monthAmount.current", () => {
    const d = buildDigest(BOOKINGS, [], NOW);
    expect(d.month.confirmedAmount).toBe(s.compare.monthAmount.current);
  });
});
