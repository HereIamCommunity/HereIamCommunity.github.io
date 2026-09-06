import { describe, it, expect } from "vitest";
import { parseAdminRow, eventForStatus } from "@/lib/admin-row";

// 열: 0신청일시 1구분 2이름 3연락처 4프로그램 5일시 6객실 7박수 8체크인 9체크아웃 10할인 11금액 12요청 13상태 14알림
const salonRow = [
  "2026. 9. 6. 오전 10:00:00", "살롱", "김코이", "010-1234-5678",
  "목요살롱 · 필사", "2026-09-10 19:00", "", "", "", "",
  "멤버십 곁 (-20%)", "30,000", "채식 부탁드려요", "신청", "",
];

const stayRow = [
  "2026. 9. 6. 오전 11:00:00", "스테이", "이노니", "01098765432",
  "", "", "나그네방", "2", "2026-09-20", "2026-09-22",
  "나그네방 후원자 (-30%)", "150000", "", "입금확인", "✅ 10:01 접수",
];

describe("parseAdminRow", () => {
  it("살롱 행을 Booking으로 바꾼다", () => {
    expect(parseAdminRow(salonRow)).toEqual({
      type: "salon",
      createdAt: "2026. 9. 6. 오전 10:00:00",
      name: "김코이",
      phone: "010-1234-5678",
      program: "목요살롱 · 필사",
      date: "2026-09-10 19:00",
      room: undefined,
      checkIn: undefined,
      checkOut: undefined,
      nights: undefined,
      discount: "geot",
      totalAmount: 30000,
    });
  });

  it("스테이 행을 Booking으로 바꾼다", () => {
    expect(parseAdminRow(stayRow)).toEqual({
      type: "stay",
      createdAt: "2026. 9. 6. 오전 11:00:00",
      name: "이노니",
      phone: "01098765432",
      program: undefined,
      date: undefined,
      room: "나그네방",
      checkIn: "2026-09-20",
      checkOut: "2026-09-22",
      nights: 2,
      discount: "nagnae",
      totalAmount: 150000,
    });
  });

  it("할인 표기가 없으면 none", () => {
    const row = [...salonRow];
    row[10] = "없음";
    expect(parseAdminRow(row).discount).toBe("none");
  });

  it("금액에 콤마·원이 섞여도 숫자로 파싱한다", () => {
    const row = [...salonRow];
    row[11] = "1,250,000원";
    expect(parseAdminRow(row).totalAmount).toBe(1250000);
  });

  it("금액이 비어 있으면 0", () => {
    const row = [...salonRow];
    row[11] = "";
    expect(parseAdminRow(row).totalAmount).toBe(0);
  });

  it("짧은 행도 이름·연락처만으로 파싱된다", () => {
    const b = parseAdminRow(["2026. 9. 6.", "살롱", "박씨", "01011112222"]);
    expect(b.name).toBe("박씨");
    expect(b.phone).toBe("01011112222");
    expect(b.totalAmount).toBe(0);
    expect(b.discount).toBe("none");
  });
});

describe("eventForStatus", () => {
  it("신청은 received", () => {
    expect(eventForStatus("신청")).toBe("received");
  });

  it("빈 상태는 received", () => {
    expect(eventForStatus("")).toBe("received");
  });

  it("입금확인은 confirmed", () => {
    expect(eventForStatus("입금확인")).toBe("confirmed");
  });

  it("결제완료는 confirmed", () => {
    expect(eventForStatus("결제완료")).toBe("confirmed");
  });

  it("취소는 cancelled", () => {
    expect(eventForStatus("취소")).toBe("cancelled");
  });
});
