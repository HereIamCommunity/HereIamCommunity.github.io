import { describe, it, expect } from "vitest";
import {
  TALCHUM_PROGRAMS,
  FESTIVAL_DAYS,
  FESTIVAL_CLOSED_DAYS,
  buildSlots,
  countKey,
  festivalDayLabel,
  isBookingFull,
  festivalCalendar,
  programsOnDay,
  TALCHUM_PROGRAMS as ALL,
} from "@/lib/programs";

/**
 * 탈춤축제(9/24–10/4) 프로그램 정의.
 *
 * 정원은 **'프로그램 + 일시' 한 칸당** 인원이고, 그 키를 `countKey`가 만든다.
 * 신청 폼의 잔여 표시(`/api/program-counts`)와 접수 API의 마감 확인이 같은 키를
 * 쓰므로, 키가 어긋나면 화면은 자리가 있다는데 서버가 막거나 그 반대가 된다.
 */

describe("festivalDayLabel — 시트에 찍히는 날짜 표기", () => {
  it("월/일/요일을 한국어로 만든다", () => {
    expect(festivalDayLabel("2026-09-24")).toBe("9월 24일 (목)");
    expect(festivalDayLabel("2026-10-04")).toBe("10월 4일 (일)");
  });

  it("자정 근처에서도 하루가 밀리지 않는다", () => {
    // KST/UTC 혼용으로 날짜가 밀린 적이 있어 양 끝을 고정해 둔다.
    expect(festivalDayLabel("2026-09-30")).toBe("9월 30일 (수)");
    expect(festivalDayLabel("2026-10-01")).toBe("10월 1일 (목)");
  });
});

describe("FESTIVAL_DAYS — 상시 프로그램의 방문일 선택지", () => {
  it("축제 기간 전체에서 휴무일만 뺀다", () => {
    expect(FESTIVAL_DAYS[0]).toBe("2026-09-24");
    expect(FESTIVAL_DAYS.at(-1)).toBe("2026-10-04");
    expect(FESTIVAL_DAYS).toHaveLength(10); // 11일 - 휴무 1일
  });

  it("9월 29일(화) 휴무는 고를 수 없다", () => {
    expect(FESTIVAL_CLOSED_DAYS).toContain("2026-09-29");
    expect(FESTIVAL_DAYS).not.toContain("2026-09-29");
  });
});

describe("buildSlots — 30분 단위 시간대", () => {
  const slots = buildSlots({ start: "14:00", end: "18:00", minutes: 30 });

  it("14:00–18:00을 30분씩 8칸으로 쪼갠다", () => {
    expect(slots).toHaveLength(8);
    expect(slots[0]).toEqual({ value: "14:00", label: "14:00–14:30" });
    expect(slots.at(-1)).toEqual({ value: "17:30", label: "17:30–18:00" });
  });

  it("끝 시각을 넘기는 칸은 만들지 않는다", () => {
    expect(buildSlots({ start: "14:00", end: "15:10", minutes: 30 })).toHaveLength(2);
  });
});

describe("countKey — 정원 집계 키", () => {
  it("프로그램과 일시를 함께 묶는다", () => {
    expect(countKey("포틀럭 파티 🍽️", "9월 26일 (토) 19:00–20:30")).not.toBe(
      countKey("포틀럭 파티 🍽️", "9월 27일 (일) 19:00–20:30")
    );
  });

  it("시트에서 읽은 값의 앞뒤 공백을 무시한다", () => {
    expect(countKey(" 캐리커쳐 ✏️ ", " 10월 2일 (금) 14:00–14:30 ")).toBe(
      countKey("캐리커쳐 ✏️", "10월 2일 (금) 14:00–14:30")
    );
  });
});

describe("TALCHUM_PROGRAMS — 정원 정의", () => {
  const byId = (id: string) => TALCHUM_PROGRAMS.find((p) => p.id === id)!;

  it("전달받은 정원이 그대로 들어가 있다", () => {
    expect(byId("t0926-potluck").capacity).toBe(12);
    expect(byId("t0925-movie").capacity).toBe(20);
    expect(byId("t1001-dj").capacity).toBe(30);
    expect(byId("t0927-run").capacity).toBe(12);
    expect(byId("t0928-contactjam").capacity).toBe(16);
    expect(byId("t0926-meditation").capacity).toBe(14);
    expect(byId("t1003-meditation").capacity).toBe(14);
  });

  it("포틀럭 5회차 모두 12명이고, 일시가 서로 달라 날짜별로 따로 찬다", () => {
    const potluck = TALCHUM_PROGRAMS.filter((p) => p.title === "포틀럭 파티 🍽️");
    expect(potluck).toHaveLength(5);
    expect(potluck.every((p) => p.capacity === 12)).toBe(true);

    const keys = potluck.map((p) => countKey(p.title, p.dateLabel));
    expect(new Set(keys).size).toBe(5);
  });

  it("스치는 대화는 30분마다 2명 — 슬롯 하나가 정원 한 칸", () => {
    const talk = byId("t-open-talk");
    expect(talk.capacity).toBe(2);
    expect(talk.slots).toEqual({ start: "14:00", end: "18:00", minutes: 30 });
    expect(buildSlots(talk.slots!)).toHaveLength(8);
  });

  it("상시 신청은 스치는 대화 하나 — 나머지 상시는 워크인이라 카드가 없다", () => {
    const open = TALCHUM_PROGRAMS.filter((p) => p.type === "talchum-open");
    expect(open.map((p) => p.id)).toEqual(["t-open-talk"]);
    expect(open.every((p) => p.pickDate)).toBe(true);

    const titles = TALCHUM_PROGRAMS.map((p) => p.title);
    expect(titles).not.toContain("탈꾸미기 & 족자 쓰기 🎭");
    expect(titles).not.toContain("캐리커쳐 ✏️");
  });

  it("날짜가 정해진 프로그램은 모두 정원이 있다", () => {
    const fixed = TALCHUM_PROGRAMS.filter((p) => p.type === "talchum");
    expect(fixed).toHaveLength(11);
    expect(fixed.filter((p) => !p.capacity)).toEqual([]);
  });

  it("모든 프로그램의 일시가 축제 기간 안에 있다", () => {
    for (const p of TALCHUM_PROGRAMS) {
      expect(p.date >= "2026-09-24" && p.date <= "2026-10-04").toBe(true);
    }
  });
});

describe("isBookingFull — 접수 API의 마감 확인", () => {
  const POTLUCK = "포틀럭 파티 🍽️";
  const D26 = "9월 26일 (토) 19:00–20:30";
  const D27 = "9월 27일 (일) 19:00–20:30";

  it("정원 미만이면 받는다", () => {
    expect(isBookingFull(POTLUCK, D26, { [countKey(POTLUCK, D26)]: 11 })).toBe(false);
  });

  it("정원을 채우면 막는다", () => {
    expect(isBookingFull(POTLUCK, D26, { [countKey(POTLUCK, D26)]: 12 })).toBe(true);
  });

  it("같은 프로그램이라도 다른 날짜는 영향받지 않는다", () => {
    const counts = { [countKey(POTLUCK, D26)]: 12 };
    expect(isBookingFull(POTLUCK, D26, counts)).toBe(true);
    expect(isBookingFull(POTLUCK, D27, counts)).toBe(false);
  });

  it("스치는 대화는 30분 칸마다 2명에서 막힌다", () => {
    const TALK = "스치는 대화 ☕";
    const a = "10월 2일 (금) 14:00–14:30";
    const b = "10월 2일 (금) 14:30–15:00";
    const counts = { [countKey(TALK, a)]: 2 };
    expect(isBookingFull(TALK, a, counts)).toBe(true);
    expect(isBookingFull(TALK, b, counts)).toBe(false);
  });

  it("집계가 비어 있으면(시트 미연동) 막지 않는다", () => {
    expect(isBookingFull(POTLUCK, D26, {})).toBe(false);
  });

  it("정원 없는 살롱 프로그램은 막지 않는다", () => {
    const counts = { [countKey("수요포틀럭 🍽️", "9월 9일 (수) 19:00")]: 999 };
    expect(isBookingFull("수요포틀럭 🍽️", "9월 9일 (수) 19:00", counts)).toBe(false);
  });

  it("워크인 프로그램은 신청 대상이 아니라 막을 것도 없다", () => {
    const CARI = "캐리커쳐 ✏️";
    const d = "10월 2일 (금) 14:00–18:00";
    expect(isBookingFull(CARI, d, { [countKey(CARI, d)]: 999 })).toBe(false);
  });

  it("모르는 프로그램명은 막지 않는다", () => {
    expect(isBookingFull("없는 프로그램", D26, { [countKey("없는 프로그램", D26)]: 99 })).toBe(false);
  });
});

describe("festivalCalendar — 신청 달력", () => {
  const weeks = festivalCalendar();
  const days = weeks.flat().filter(Boolean);

  it("월요일 시작 7칸짜리 주로 채운다", () => {
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("9/24(목)이 첫 주의 목요일 칸에 온다", () => {
    // 월화수 = null, 목요일부터 시작
    expect(weeks[0].slice(0, 3).every((d) => d === null)).toBe(true);
    expect(weeks[0][3]?.iso).toBe("2026-09-24");
  });

  it("축제 기간 11일을 모두 담는다 (휴무 포함)", () => {
    expect(days).toHaveLength(11);
    expect(days[0]!.iso).toBe("2026-09-24");
    expect(days.at(-1)!.iso).toBe("2026-10-04");
  });

  it("휴무일은 closed 로 표시된다", () => {
    expect(days.find((d) => d!.iso === "2026-09-29")!.closed).toBe(true);
    expect(days.filter((d) => d!.closed)).toHaveLength(1);
  });

  it("요일이 실제 달력과 맞는다", () => {
    expect(days.find((d) => d!.iso === "2026-09-27")!.weekday).toBe(0); // 일
    expect(days.find((d) => d!.iso === "2026-10-03")!.weekday).toBe(6); // 토
  });
});

describe("programsOnDay — 그 날 신청 가능한 프로그램", () => {
  it("그 날짜에 열리는 프로그램만 준다", () => {
    const titles = programsOnDay(ALL, "2026-09-25").map((p) => p.title);
    expect(titles).toContain("무비올나잇 🎬");
    expect(titles).not.toContain("포틀럭 파티 🍽️");
  });

  it("상시 프로그램은 어느 날에나 들어간다", () => {
    for (const iso of ["2026-09-24", "2026-09-30", "2026-10-04"]) {
      expect(programsOnDay(ALL, iso).map((p) => p.title)).toContain("스치는 대화 ☕");
    }
  });

  it("포틀럭은 열리는 5일에만 뜬다", () => {
    const openDays = FESTIVAL_DAYS.filter((d) =>
      programsOnDay(ALL, d).some((p) => p.title === "포틀럭 파티 🍽️")
    );
    expect(openDays).toEqual([
      "2026-09-26", "2026-09-27", "2026-09-30", "2026-10-01", "2026-10-02",
    ]);
  });

  it("휴무일에는 아무것도 열리지 않는다", () => {
    expect(programsOnDay(ALL, "2026-09-29")).toEqual([]);
  });

  it("9/28에는 컨택 잼이 열린다 (즉흥 공연은 워크인이라 신청 목록엔 없다)", () => {
    const titles = programsOnDay(ALL, "2026-09-28").map((p) => p.title);
    expect(titles).toContain("컨택 잼 워크숍 💫");
    expect(titles).not.toContain("즉흥 댄스 공연");
  });
});
