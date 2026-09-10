import { describe, it, expect } from "vitest";
import {
  selectBulkTargets,
  bulkJobId,
  planBulkWrites,
  planRevertWrites,
  parseBulkRequest,
  type BulkFilter,
} from "@/lib/bulk";
import type { RowMeta } from "@/lib/row-ref";

/**
 * 고정 시각: KST 2026-09-10.
 * bulk.ts의 now는 "실제 시각(instant)"이다 — usageDateISO·silentStatusText 둘 다
 * Intl의 timeZone: "Asia/Seoul"로 변환하기 때문에 머신 TZ와 무관하게 같은 값이 나온다.
 */
const NOW = new Date("2026-09-10T00:00:00+09:00");

const HEADER = [
  "신청일시","구분","이름","연락처","프로그램","일시","객실","박수",
  "체크인","체크아웃","할인","결제금액","요청사항","상태","알림",
];

/** 살롱: 5(일시) / 스테이: 8(체크인) 이 사용일 */
function salon(name: string, date: string, status: string, notify = ""): string[] {
  const r = new Array(15).fill("");
  r[0] = "2026. 9. 1. 오후 2:00:00";
  r[1] = "살롱"; r[2] = name; r[3] = "01011112222";
  r[4] = "프라이데이나잇"; r[5] = date; r[11] = "30000";
  r[13] = status; r[14] = notify;
  return r;
}
function stay(name: string, checkIn: string, status: string, notify = ""): string[] {
  const r = new Array(15).fill("");
  r[0] = "2026. 9. 1. 오후 2:00:00";
  r[1] = "스테이"; r[2] = name; r[3] = "01033334444";
  r[6] = "옥순방"; r[7] = "1"; r[8] = checkIn; r[9] = "2026-09-16"; r[11] = "120000";
  r[13] = status; r[14] = notify;
  return r;
}

// 살롱 탭 2~4행, 스테이 탭 2~4행 (헤더는 각 탭 1행)
const ROWS: string[][] = [
  HEADER,
  salon("김살롱", "9월 5일 (토) 20:00", ""),          // 연도 없는 라벨 → 2026-09-05, 입금대기
  salon("박살롱", "9월 20일 (일) 19:00", "신청"),      // 2026-09-20, 입금대기
  salon("빈살롱", "", "신청"),                          // 사용일 불명
  stay("이스테이", "2026-09-01", "입금확인", "✅ 10:00 확정"),
  stay("최스테이", "2026-09-15", "취소"),
  stay("결제스테이", "2026-09-08", "결제완료"),
];
const META: RowMeta[] = [
  { tab: "살롱", rowNum: 1 },
  { tab: "살롱", rowNum: 2 },
  { tab: "살롱", rowNum: 3 },
  { tab: "살롱", rowNum: 4 },
  { tab: "스테이", rowNum: 2 },
  { tab: "스테이", rowNum: 3 },
  { tab: "스테이", rowNum: 4 },
];

const ALL: BulkFilter = { status: "all", type: "all" };
const names = (f: BulkFilter) => selectBulkTargets(ROWS, META, f, NOW).map((t) => t.name);

describe("selectBulkTargets", () => {
  it("헤더 행은 대상이 아니다", () => {
    expect(names(ALL)).not.toContain("이름");
  });

  it("사용일을 못 읽는 행은 제외한다", () => {
    expect(names(ALL)).not.toContain("빈살롱");
  });

  it("조건이 없으면 사용일을 읽을 수 있는 행 전부", () => {
    expect(names(ALL)).toEqual(["김살롱", "박살롱", "이스테이", "최스테이", "결제스테이"]);
  });

  it("usageBefore는 사용일 < 기준일 (연도 없는 살롱 라벨도 now의 연도로 판정)", () => {
    expect(names({ ...ALL, usageBefore: "2026-09-10" })).toEqual([
      "김살롱", "이스테이", "결제스테이",
    ]);
  });

  it("usageAfter는 사용일 >= 기준일", () => {
    expect(names({ ...ALL, usageAfter: "2026-09-10" })).toEqual(["박살롱", "최스테이"]);
  });

  it("status pending은 빈값·신청", () => {
    expect(names({ ...ALL, status: "pending" })).toEqual(["김살롱", "박살롱"]);
  });

  it("status confirmed는 입금확인·결제완료·확정", () => {
    expect(names({ ...ALL, status: "confirmed" })).toEqual(["이스테이", "결제스테이"]);
  });

  it("status cancelled는 취소", () => {
    expect(names({ ...ALL, status: "cancelled" })).toEqual(["최스테이"]);
  });

  it("type은 구분(B열)으로 거른다", () => {
    expect(names({ ...ALL, type: "salon" })).toEqual(["김살롱", "박살롱"]);
    expect(names({ ...ALL, type: "stay" })).toEqual(["이스테이", "최스테이", "결제스테이"]);
  });

  it("조건을 조합하면 교집합 — 9/10 이전 + 입금대기 + 살롱", () => {
    expect(names({ usageBefore: "2026-09-10", status: "pending", type: "salon" })).toEqual([
      "김살롱",
    ]);
  });

  it("대상에 ref·사용일·상태 원값이 담긴다", () => {
    const t = selectBulkTargets(ROWS, META, { ...ALL, type: "stay", status: "confirmed" }, NOW);
    expect(t[0]).toMatchObject({
      ref: { tab: "스테이", rowNum: 2 },
      name: "이스테이",
      type: "stay",
      usage: "2026-09-01",
      status: "입금확인",
      notify: "✅ 10:00 확정",
    });
  });
});

describe("bulkJobId", () => {
  const a = { tab: "살롱", rowNum: 2 } as const;
  const b = { tab: "스테이", rowNum: 7 } as const;

  it("같은 집합이면 같은 값 (결정적)", () => {
    expect(bulkJobId([a, b])).toBe(bulkJobId([a, b]));
  });
  it("순서가 달라도 같은 값", () => {
    expect(bulkJobId([b, a])).toBe(bulkJobId([a, b]));
  });
  it("집합이 다르면 다른 값", () => {
    expect(bulkJobId([a])).not.toBe(bulkJobId([a, b]));
  });
  it("12자 hex", () => {
    expect(bulkJobId([a, b])).toMatch(/^[0-9a-f]{12}$/);
  });
  it("대상이 없으면 빈 집합의 해시", () => {
    expect(bulkJobId([])).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("planBulkWrites", () => {
  // KST 14:32 (머신 TZ 무관)
  const AT = new Date("2026-09-10T05:32:00Z");
  const targets = selectBulkTargets(ROWS, META, ALL, NOW);

  it("허용되지 않는 전이는 skip으로 빠지고 사유가 담긴다", () => {
    const p = planBulkWrites(targets, "confirm", false, AT);
    expect(p.applied).toEqual([
      { tab: "살롱", rowNum: 2 },
      { tab: "살롱", rowNum: 3 },
    ]);
    const skippedNames = p.skipped.map((s) => s.name);
    expect(skippedNames).toEqual(["이스테이", "최스테이", "결제스테이"]);
    expect(p.skipped[0].reason).toBe("이미 '입금확인' 상태입니다.");
    // 결제완료(토스 승인) 행은 하향 + 확정 알림 중복이라 막힌다 — reopen 후 다시.
    expect(p.skipped[2].reason).toContain("입금확인으로 바꿀 수 없습니다");
  });

  it("notify:false면 N열 + O열(🔕 문구)을 같이 쓴다", () => {
    const p = planBulkWrites(targets.slice(0, 1), "confirm", false, AT);
    expect(p.writes).toEqual([
      { range: "살롱!N2", values: [["입금확인"]] },
      { range: "살롱!O2", values: [["🔕 14:32 확정 알림 없음"]] },
    ]);
  });

  it("notify:true면 N열만 쓴다 (O열은 notifyBooking이 남긴다)", () => {
    const p = planBulkWrites(targets.slice(0, 1), "confirm", true, AT);
    expect(p.writes).toEqual([{ range: "살롱!N2", values: [["입금확인"]] }]);
  });

  it("reopen은 알림 이벤트가 없어 notify:false여도 O열을 건드리지 않는다", () => {
    const t = selectBulkTargets(ROWS, META, { ...ALL, status: "confirmed" }, NOW);
    const p = planBulkWrites(t, "reopen", false, AT);
    expect(p.writes).toEqual([
      { range: "스테이!N2", values: [["신청"]] },
      { range: "스테이!N4", values: [["신청"]] },
    ]);
  });

  it("취소는 🔕 취소 알림 없음", () => {
    const p = planBulkWrites(targets.slice(0, 1), "cancel", false, AT);
    expect(p.writes[1]).toEqual({ range: "살롱!O2", values: [["🔕 14:32 취소 알림 없음"]] });
  });

  it("스냅샷은 쓰기 전 N·O 원값 (적용된 행만)", () => {
    const t = selectBulkTargets(ROWS, META, { ...ALL, status: "confirmed" }, NOW);
    const p = planBulkWrites(t, "reopen", false, AT);
    expect(p.snapshot).toEqual([
      { ref: { tab: "스테이", rowNum: 2 }, status: "입금확인", notify: "✅ 10:00 확정" },
      { ref: { tab: "스테이", rowNum: 4 }, status: "결제완료", notify: "" },
    ]);
  });
});

describe("planRevertWrites", () => {
  it("스냅샷 한 건당 N·O 두 셀을 원값으로", () => {
    expect(
      planRevertWrites([{ ref: { tab: "스테이", rowNum: 9 }, status: "", notify: "" }])
    ).toEqual([
      { range: "스테이!N9", values: [[""]] },
      { range: "스테이!O9", values: [[""]] },
    ]);
  });
});

describe("parseBulkRequest", () => {
  const good = {
    mode: "preview",
    filter: { usageBefore: "2026-09-10", status: "pending", type: "all" },
    action: "confirm",
  };

  it("정상 요청 — notify 기본값은 false(알림 안 보냄)", () => {
    const r = parseBulkRequest(good);
    expect(r.ok && r.value).toEqual({
      mode: "preview",
      filter: { usageBefore: "2026-09-10", status: "pending", type: "all" },
      action: "confirm",
      notify: false,
    });
  });

  it("run은 jobId를 함께 받는다", () => {
    const r = parseBulkRequest({ ...good, mode: "run", jobId: "abc123abc123", notify: true });
    expect(r.ok && r.value.jobId).toBe("abc123abc123");
    expect(r.ok && r.value.notify).toBe(true);
  });

  it("run에 jobId가 없으면 400", () => {
    const r = parseBulkRequest({ ...good, mode: "run" });
    expect(r.ok).toBe(false);
  });

  it("모르는 mode·action·status·type은 400", () => {
    expect(parseBulkRequest({ ...good, mode: "danger" }).ok).toBe(false);
    expect(parseBulkRequest({ ...good, action: "delete" }).ok).toBe(false);
    expect(parseBulkRequest({ ...good, filter: { status: "??", type: "all" } }).ok).toBe(false);
    expect(parseBulkRequest({ ...good, filter: { status: "all", type: "retreat" } }).ok).toBe(false);
  });

  it("filter가 없거나 날짜 형식이 틀리면 400", () => {
    expect(parseBulkRequest({ mode: "preview", action: "confirm" }).ok).toBe(false);
    expect(
      parseBulkRequest({ ...good, filter: { usageBefore: "2026-9-1", status: "all", type: "all" } }).ok
    ).toBe(false);
    expect(
      parseBulkRequest({ ...good, filter: { usageAfter: "내일", status: "all", type: "all" } }).ok
    ).toBe(false);
  });

  it("body가 아예 없으면 400", () => {
    expect(parseBulkRequest(undefined).ok).toBe(false);
    expect(parseBulkRequest({}).ok).toBe(false);
  });
});
