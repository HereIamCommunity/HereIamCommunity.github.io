import { describe, it, expect } from "vitest";
import {
  bookingCheckResults,
  bookingInsert,
  bookingToRow,
  buildBookingList,
  buildSimpleList,
  digitsOnly,
  openStayInsert,
  openStayToRow,
  OPEN_STAY_HEADER,
  patchesPayload,
  pickByCreatedAtThenLatest,
  retreatCounts,
  retreatInsert,
  retreatToRow,
  RETREAT_HEADER,
  type BookingRecord,
  type OpenStayRecord,
  type RetreatRecord,
} from "@/lib/store-rows";
import { BOOKING_HEADER } from "@/lib/row-ref";
import { RETREAT_SESSIONS } from "@/lib/retreat-sessions";

// 2026. 9. 6. 오후 7:10:32 (KST)
const CREATED_ISO = "2026-09-06T10:10:32.000Z";
const CREATED_TEXT = "2026. 9. 6. 오후 7:10:32";

function booking(over: Partial<BookingRecord>): BookingRecord {
  return {
    id: 1, kind: "salon", created_at: CREATED_ISO, name: "김살롱", phone: "010-1111-2222",
    program: "프라이데이나잇", date_text: "9월 20일 (일) 19:00", room: "", nights: "",
    check_in: "", check_out: "", discount: "없음", total_amount: 30000, memo: "",
    status: "신청", notify_status: "", ...over,
  };
}

describe("bookingToRow", () => {
  it("시트와 같은 A~O 15열 순서", () => {
    const row = bookingToRow(booking({ memo: "창가 자리", notify_status: "✅ 10:00 접수" }));
    expect(row).toEqual([
      CREATED_TEXT, "살롱", "김살롱", "010-1111-2222", "프라이데이나잇", "9월 20일 (일) 19:00",
      "", "", "", "", "없음", "30000", "창가 자리", "신청", "✅ 10:00 접수",
    ]);
    expect(row).toHaveLength(BOOKING_HEADER.length);
  });

  it("신청일시·금액이 비었으면 빈 문자열 (수기 입력 행)", () => {
    const row = bookingToRow(booking({ kind: "stay", created_at: null, total_amount: null }));
    expect(row[0]).toBe("");
    expect(row[1]).toBe("스테이");
    expect(row[11]).toBe("");
  });
});

describe("buildBookingList", () => {
  it("헤더 + 살롱 전체 + 스테이 전체, 각 탭 안은 id 오름차순 — meta는 길이·순서가 같다", () => {
    const { rows, meta } = buildBookingList([
      booking({ id: 5, kind: "stay", name: "B" }),
      booking({ id: 3, kind: "salon", name: "A2" }),
      booking({ id: 1, kind: "salon", name: "A1" }),
      booking({ id: 4, kind: "stay", name: "B0" }),
    ]);
    expect(rows.map((r) => r[2])).toEqual(["이름", "A1", "A2", "B0", "B"]);
    expect(meta).toEqual([
      { tab: "살롱", id: 0 },
      { tab: "살롱", id: 1 },
      { tab: "살롱", id: 3 },
      { tab: "스테이", id: 4 },
      { tab: "스테이", id: 5 },
    ]);
  });

  it("비어 있으면 헤더 한 줄 + 헤더 자리 meta", () => {
    expect(buildBookingList([])).toEqual({ rows: [BOOKING_HEADER], meta: [{ tab: "살롱", id: 0 }] });
  });

  it("헤더 배열을 복사해서 준다 — 받은 쪽이 고쳐도 공용 상수가 오염되지 않게", () => {
    const { rows } = buildBookingList([]);
    expect(rows[0]).not.toBe(BOOKING_HEADER);
  });
});

describe("리트릿·무료개방 행", () => {
  const retreat: RetreatRecord = {
    id: 7, created_at: CREATED_ISO, name: "이리트", phone: "01033334444", grade: "고2", region: "안동",
    session: "1회차 7/3-5", referral: "", question: "?", memo: "m", allergy: "땅콩",
    care: "", parent_note: "p", status: "신청",
  };
  const open: OpenStayRecord = {
    id: 9, created_at: null, name: "박개방", phone: "010", email: "a@b.c", check_in: "2026-09-20",
    check_out: "2026-09-21", group_type: "혼자", group_size: "1", reason: "r", contribution: "청소",
    message: "", status: "확정",
  };

  it("리트릿은 A~M 13열", () => {
    const row = retreatToRow(retreat);
    expect(row).toHaveLength(RETREAT_HEADER.length);
    expect(row[0]).toBe(CREATED_TEXT);
    expect(row[5]).toBe("1회차 7/3-5");
    expect(row[12]).toBe("신청");
  });

  it("무료개방은 A~L 12열", () => {
    const row = openStayToRow(open);
    expect(row).toHaveLength(OPEN_STAY_HEADER.length);
    expect(row[0]).toBe("");
    expect(row[11]).toBe("확정");
  });

  it("buildSimpleList는 헤더 + id 오름차순, meta 헤더 자리는 id 0", () => {
    const { rows, meta } = buildSimpleList([{ ...retreat, id: 8 }, retreat], retreatToRow, RETREAT_HEADER, "리트릿");
    expect(rows).toHaveLength(3);
    expect(meta).toEqual([{ tab: "리트릿", id: 0 }, { tab: "리트릿", id: 7 }, { tab: "리트릿", id: 8 }]);
  });
});

describe("입력 → 레코드", () => {
  it("예약: 신청일시는 실제 시각, 할인 코드는 표시 문자열, 금액은 정수", () => {
    expect(
      bookingInsert({
        type: "stay", createdAt: CREATED_TEXT, name: "홍", phone: "010-1", room: "옥순방",
        nights: "2", checkIn: "2026-09-20", checkOut: "2026-09-22", discount: "geot",
        totalAmount: 240000, status: "신청",
      })
    ).toEqual({
      kind: "stay", created_at: CREATED_ISO, name: "홍", phone: "010-1", program: "", date_text: "",
      room: "옥순방", nights: "2", check_in: "2026-09-20", check_out: "2026-09-22",
      discount: "멤버십 곁 (-20%)", total_amount: 240000, memo: "", status: "신청", notify_status: "",
    });
  });

  it("할인 코드: nagnae → 나그네방 후원자, 그 밖에는 없음", () => {
    const base = { type: "salon", createdAt: "", name: "", phone: "", totalAmount: 0, status: "신청" };
    expect(bookingInsert({ ...base, discount: "nagnae" }).discount).toBe("나그네방 후원자 (-30%)");
    expect(bookingInsert({ ...base, discount: "none" }).discount).toBe("없음");
  });

  it("금액이 숫자가 아니면 null, 신청일시 형식이 다르면 null", () => {
    const r = bookingInsert({
      type: "salon", createdAt: "어제", name: "", phone: "", discount: "none",
      totalAmount: undefined as unknown as number, status: "신청",
    });
    expect(r.total_amount).toBeNull();
    expect(r.created_at).toBeNull();
    expect(r.kind).toBe("salon");
  });

  it("리트릿: 회차 키를 라벨로 바꿔 저장 (시트와 같다)", () => {
    const r = retreatInsert({
      createdAt: CREATED_TEXT, name: "a", phone: "b", grade: "c", region: "d", session: "s1",
      referral: "", question: "", memo: "", allergy: "", care: "", parentNote: "pn", status: "신청",
    });
    expect(r.session).toBe(RETREAT_SESSIONS.find((s) => s.key === "s1")!.label);
    expect(r.parent_note).toBe("pn");
    expect(r.created_at).toBe(CREATED_ISO);
  });

  it("무료개방: 필드 이름만 바꿔 그대로", () => {
    const r = openStayInsert({
      createdAt: CREATED_TEXT, name: "a", phone: "b", email: "e", checkIn: "i", checkOut: "o",
      groupType: "팀/모임", groupSize: "4", reason: "r", contribution: "청소, 요리", message: "m", status: "신청",
    });
    expect(r).toEqual({
      created_at: CREATED_ISO, name: "a", phone: "b", email: "e", check_in: "i", check_out: "o",
      group_type: "팀/모임", group_size: "4", reason: "r", contribution: "청소, 요리", message: "m", status: "신청",
    });
  });
});

describe("행 찾기 규칙 (ref 없을 때)", () => {
  const a = booking({ id: 1, created_at: CREATED_ISO });
  const b = booking({ id: 2, created_at: "2026-09-07T01:00:00.000Z" });

  it("신청일시가 같은 행이 있으면 그 행", () => {
    expect(pickByCreatedAtThenLatest([a, b], CREATED_TEXT)?.id).toBe(1);
  });

  it("없으면 가장 최근(id 큰) 행", () => {
    expect(pickByCreatedAtThenLatest([a, b], "2020. 1. 1. 오전 1:00:00")?.id).toBe(2);
  });

  it("후보가 없으면 null", () => {
    expect(pickByCreatedAtThenLatest([], CREATED_TEXT)).toBeNull();
  });

  it("digitsOnly는 숫자만", () => {
    expect(digitsOnly("010-1234 5678")).toBe("01012345678");
    expect(digitsOnly(undefined as unknown as string)).toBe("");
  });
});

describe("bookingCheckResults (예약 확인 페이지)", () => {
  it("최신순, 살롱은 프로그램·일시, 스테이는 객실·기간", () => {
    const res = bookingCheckResults([
      booking({ id: 1 }),
      booking({ id: 2, kind: "stay", room: "옥순방", check_in: "2026-09-20", check_out: "2026-09-22", nights: "2", status: "" }),
    ]);
    expect(res.map((r) => r.type)).toEqual(["스테이", "살롱"]);
    expect(res[0]).toMatchObject({ program: "옥순방", date: "2026-09-20 ~ 2026-09-22 (2박)", status: "신청" });
    expect(res[1]).toMatchObject({ program: "프라이데이나잇", date: "9월 20일 (일) 19:00", amount: "30000", createdAt: CREATED_TEXT });
  });

  it("신청일시가 없는 수기 입력 행은 빼준다 (시트 시절과 같다)", () => {
    expect(bookingCheckResults([booking({ created_at: null })])).toEqual([]);
  });
});

describe("retreatCounts", () => {
  it("라벨을 회차 키로 세고, 모르는 라벨은 무시, 없는 회차는 0", () => {
    const [s1, s2] = RETREAT_SESSIONS;
    const counts = retreatCounts([s1.label, s1.label, s2.label, "옛 회차"]);
    expect(counts[s1.key]).toBe(2);
    expect(counts[s2.key]).toBe(1);
    expect(Object.keys(counts).sort()).toEqual(RETREAT_SESSIONS.map((s) => s.key).sort());
  });
});

describe("patchesPayload", () => {
  it("DB 함수에 넘길 모양 — 없는 키는 빼고, 빈 문자열은 그대로", () => {
    expect(
      patchesPayload([
        { ref: { tab: "살롱", id: 3 }, status: "입금확인" },
        { ref: { tab: "스테이", id: 4 }, status: "", notify: "" },
      ])
    ).toEqual([{ id: 3, status: "입금확인" }, { id: 4, status: "", notify: "" }]);
  });

  it("예약이 아닌 탭이 섞이면 거부 — 다른 테이블 id를 예약 id로 오해하지 않게", () => {
    expect(() => patchesPayload([{ ref: { tab: "리트릿", id: 3 }, status: "확정" }])).toThrow(/리트릿/);
  });
});
