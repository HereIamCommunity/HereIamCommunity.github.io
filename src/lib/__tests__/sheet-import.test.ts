import { describe, it, expect } from "vitest";
import {
  bulkLogImport,
  diffImported,
  importBookingRow,
  importOpenStayRow,
  importRetreatRow,
  isBlankRow,
  mapSnapshotRefs,
  parseSheetBulkLogRow,
} from "@/lib/sheet-import";

const CREATED_TEXT = "2026. 9. 6. 오후 7:10:32";
const CREATED_ISO = "2026-09-06T10:10:32.000Z";

function stayRow(over: Record<number, string> = {}): string[] {
  const r = [
    CREATED_TEXT, "스테이", "홍길동", "010-1234-5678", "", "", "옥순방", "2",
    "2026-09-20", "2026-09-22", "없음", "240000", "창가", "입금확인", "✅ 10:00 확정",
  ];
  for (const [i, v] of Object.entries(over)) r[Number(i)] = v;
  return r;
}

describe("importBookingRow", () => {
  it("열을 그대로 옮기고 신청일시는 실제 시각, 종류는 탭으로 정한다", () => {
    const { record, warnings } = importBookingRow(stayRow({ 1: "살롱?" }), "stay", 12);
    expect(record).toEqual({
      sheet_row: 12, kind: "stay", created_at: CREATED_ISO, name: "홍길동", phone: "010-1234-5678",
      program: "", date_text: "", room: "옥순방", nights: "2", check_in: "2026-09-20", check_out: "2026-09-22",
      discount: "없음", total_amount: 240000, memo: "창가", status: "입금확인", notify_status: "✅ 10:00 확정",
    });
    expect(warnings).toEqual([]);
  });

  it("금액 '150,000'·'150000원'은 숫자만", () => {
    expect(importBookingRow(stayRow({ 11: "150,000" }), "stay", 2).record.total_amount).toBe(150000);
    expect(importBookingRow(stayRow({ 11: "150000원" }), "stay", 2).record.total_amount).toBe(150000);
  });

  it("금액이 비면 null, 경고 없음", () => {
    const { record, warnings } = importBookingRow(stayRow({ 11: "" }), "stay", 2);
    expect(record.total_amount).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("숫자가 없는 금액은 null + 요청사항 끝에 원래 값을 남기고 경고", () => {
    const { record, warnings } = importBookingRow(stayRow({ 11: "무료" }), "stay", 7);
    expect(record.total_amount).toBeNull();
    expect(record.memo).toBe("창가\n[이전 전 금액: 무료]");
    expect(warnings).toEqual(["스테이 7행: 금액을 숫자로 못 읽음 \"무료\" → 요청사항에 보존"]);
  });

  it("신청일시가 비면 null (수기 입력 행), 경고 없음", () => {
    const { record, warnings } = importBookingRow(stayRow({ 0: "" }), "stay", 3);
    expect(record.created_at).toBeNull();
    expect(warnings).toEqual([]);
  });

  it("신청일시 형식을 못 읽으면 null + 요청사항에 원래 값을 남기고 경고", () => {
    const { record, warnings } = importBookingRow(stayRow({ 0: "9/6 저녁", 12: "" }), "stay", 4);
    expect(record.created_at).toBeNull();
    expect(record.memo).toBe("[이전 전 신청일시: 9/6 저녁]");
    expect(warnings[0]).toContain("신청일시");
  });

  it("짧은 행(시트 API가 뒤쪽 빈 칸을 자름)도 빈 문자열로 채운다", () => {
    const { record } = importBookingRow(["", "살롱", "김"], "salon", 5);
    expect(record.status).toBe("");
    expect(record.notify_status).toBe("");
    expect(record.kind).toBe("salon");
  });
});

describe("리트릿·무료개방", () => {
  it("리트릿 A~M", () => {
    const v = [CREATED_TEXT, "이", "010", "고2", "안동", "1회차", "추천", "질문", "요청", "땅콩", "케어", "부모", "신청"];
    expect(importRetreatRow(v, 2).record).toEqual({
      sheet_row: 2, created_at: CREATED_ISO, name: "이", phone: "010", grade: "고2", region: "안동",
      session: "1회차", referral: "추천", question: "질문", memo: "요청", allergy: "땅콩", care: "케어",
      parent_note: "부모", status: "신청",
    });
  });

  it("무료개방 A~L, 못 읽은 신청일시는 응원메시지 칸에 보존", () => {
    const v = ["어제", "박", "010", "e", "i", "o", "혼자", "1", "r", "청소", "", "확정"];
    const { record } = importOpenStayRow(v, 9);
    expect(record.created_at).toBeNull();
    expect(record.message).toBe("[이전 전 신청일시: 어제]");
    expect(record.status).toBe("확정");
  });
});

describe("isBlankRow", () => {
  it("공백뿐이면 빈 행", () => {
    expect(isBlankRow(["", " ", ""])).toBe(true);
    expect(isBlankRow([])).toBe(true);
    expect(isBlankRow(["", "x"])).toBe(false);
  });
});

describe("일괄 처리 로그", () => {
  const row = [
    "abc123abc123", "2026-09-10 14:32:05", '{"status":"pending","type":"all"}', "confirm", "없음", "2",
    '[["살롱#2","신청",""],["스테이#12","","✅ 10:00 접수"]]', "",
  ];

  it("시트 로그 한 줄을 읽는다", () => {
    const log = parseSheetBulkLogRow(row, 4)!;
    expect(log).toMatchObject({
      sheetRow: 4, jobId: "abc123abc123", at: "2026-09-10 14:32:05", action: "confirm",
      notify: false, count: 2, reverted: "",
      filter: { status: "pending", type: "all" },
    });
    expect(log.snapshot).toEqual([
      { tab: "살롱", sheetRow: 2, status: "신청", notify: "" },
      { tab: "스테이", sheetRow: 12, status: "", notify: "✅ 10:00 접수" },
    ]);
  });

  it("헤더·빈 줄은 null", () => {
    expect(parseSheetBulkLogRow(["jobId", "시각"], 1)).toBeNull();
    expect(parseSheetBulkLogRow([], 3)).toBeNull();
  });

  it("시트 행 번호를 DB id로 바꾸고, 못 찾은 항목은 따로 모은다", () => {
    const log = parseSheetBulkLogRow(row, 4)!;
    const ids = new Map([["살롱#2", 101]]);
    const { snapshot, missing } = mapSnapshotRefs(log.snapshot, (tab, n) => ids.get(`${tab}#${n}`));
    expect(snapshot).toEqual([{ ref: { tab: "살롱", id: 101 }, status: "신청", notify: "" }]);
    expect(missing).toEqual([{ tab: "스테이", sheetRow: 12, status: "", notify: "✅ 10:00 접수" }]);
  });

  it("DB 레코드 모양으로", () => {
    const log = parseSheetBulkLogRow(row, 4)!;
    const rec = bulkLogImport(log, [{ ref: { tab: "살롱", id: 101 }, status: "신청", notify: "" }]);
    expect(rec).toEqual({
      sheet_row: 4, job_id: "abc123abc123", at: "2026-09-10 14:32:05",
      filter: { status: "pending", type: "all" }, action: "confirm", notify: false, count: 2,
      snapshot: [{ ref: { tab: "살롱", id: 101 }, status: "신청", notify: "" }], reverted_at: "",
    });
  });
});

describe("diffImported", () => {
  it("지정한 칸 중 값이 다른 칸 이름만", () => {
    expect(
      diffImported({ status: "신청", memo: "a", name: "x" }, { status: "입금확인", memo: "a", name: "y" }, ["status", "memo"])
    ).toEqual(["status"]);
  });

  it("null과 빈 문자열은 같다고 본다", () => {
    expect(diffImported({ memo: "" }, { memo: null }, ["memo"])).toEqual([]);
  });
});
