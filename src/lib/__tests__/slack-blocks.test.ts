import { describe, it, expect } from "vitest";
import { buildHostBlocks, buildSimpleBlocks } from "@/lib/slack-blocks";
import { buildHostMessage, type Booking } from "@/lib/kakao";

/* Block Kit 순수 빌더 — 네트워크 없음. 슬랙에 실제로 보내지 않는다. */

const at = new Date("2026-09-10T05:12:00Z"); // KST 14:12

const salon: Booking = {
  type: "salon",
  name: "홍길동",
  phone: "010-1234-5678",
  program: "가을 살롱",
  date: "9월 20일 14:00",
  totalAmount: 30000,
};

const stay: Booking = {
  type: "stay",
  name: "김스테이",
  phone: "010-9999-8888",
  room: "나그네방",
  checkIn: "2026-10-01",
  checkOut: "2026-10-03",
  nights: 2,
  totalAmount: 120000,
};

type Block = Record<string, unknown>;

function headerText(blocks: Block[]): string {
  const h = blocks.find((b) => b.type === "header") as
    | { text?: { text?: string } }
    | undefined;
  return h?.text?.text ?? "";
}

function fieldTexts(blocks: Block[]): string[] {
  const s = blocks.find((b) => b.type === "section") as
    | { fields?: { text?: string }[] }
    | undefined;
  return (s?.fields ?? []).map((f) => f.text ?? "");
}

function contextTexts(blocks: Block[]): string[] {
  const c = blocks.find((b) => b.type === "context") as
    | { elements?: { text?: string }[] }
    | undefined;
  return (c?.elements ?? []).map((e) => e.text ?? "");
}

function actionUrls(blocks: Block[]): string[] {
  const a = blocks.find((b) => b.type === "actions") as
    | { elements?: { url?: string }[] }
    | undefined;
  return (a?.elements ?? []).map((e) => e.url ?? "");
}

describe("buildHostBlocks — header 이모지", () => {
  it("새 신청은 🆕", () => {
    expect(headerText(buildHostBlocks("received", salon, { at }).blocks)).toContain("🆕");
  });

  it("어드민 입금확인은 ✅", () => {
    const t = headerText(buildHostBlocks("confirmed", { ...salon, via: "admin" }, { at }).blocks);
    expect(t).toContain("✅");
    expect(t).not.toContain("💳");
  });

  it("카드결제 확정은 💳", () => {
    const t = headerText(buildHostBlocks("confirmed", { ...salon, via: "toss" }, { at }).blocks);
    expect(t).toContain("💳");
    expect(t).not.toContain("✅");
  });

  it("취소는 ❌", () => {
    expect(headerText(buildHostBlocks("cancelled", salon, { at }).blocks)).toContain("❌");
  });

  it("header에 이벤트 이름과 구분(살롱/스테이)이 함께 들어간다", () => {
    expect(headerText(buildHostBlocks("received", salon, { at }).blocks)).toContain("새 신청");
    expect(headerText(buildHostBlocks("received", salon, { at }).blocks)).toContain("살롱");
    expect(headerText(buildHostBlocks("received", stay, { at }).blocks)).toContain("스테이");
    expect(
      headerText(buildHostBlocks("confirmed", { ...salon, via: "toss" }, { at }).blocks)
    ).toContain("카드결제 완료");
  });
});

describe("buildHostBlocks — section fields", () => {
  it("살롱은 이름·연락처·내용·일시·금액을 담는다", () => {
    const f = fieldTexts(buildHostBlocks("received", salon, { at }).blocks);
    expect(f.join("\n")).toContain("홍길동");
    expect(f.join("\n")).toContain("010-1234-5678");
    expect(f.join("\n")).toContain("가을 살롱");
    expect(f.join("\n")).toContain("9월 20일 14:00");
    expect(f.join("\n")).toContain("30,000원");
  });

  it("스테이는 객실과 체크인~체크아웃(N박)이 들어간다", () => {
    const f = fieldTexts(buildHostBlocks("received", stay, { at }).blocks).join("\n");
    expect(f).toContain("나그네방");
    expect(f).toContain("2026-10-01 ~ 2026-10-03");
    expect(f).toContain("2박");
  });

  it("연락처는 tel 링크가 아니라 텍스트다", () => {
    const f = fieldTexts(buildHostBlocks("received", salon, { at }).blocks).join("\n");
    expect(f).not.toContain("tel:");
    expect(f).not.toContain("<");
  });

  it("금액 뒤에 상태가 붙는다 — 접수는 입금 대기, 카드결제는 카드결제 완료", () => {
    expect(fieldTexts(buildHostBlocks("received", salon, { at }).blocks).join("\n")).toContain(
      "입금 대기"
    );
    expect(
      fieldTexts(buildHostBlocks("confirmed", { ...salon, via: "toss" }, { at }).blocks).join("\n")
    ).toContain("카드결제 완료");
    expect(
      fieldTexts(buildHostBlocks("confirmed", { ...salon, via: "admin" }, { at }).blocks).join("\n")
    ).toContain("입금 확인");
  });
});

describe("buildHostBlocks — context (게스트 알림 결과)", () => {
  it("게스트 실패는 굵게 강조하고 재발송을 안내한다", () => {
    const c = contextTexts(
      buildHostBlocks("received", salon, { at, guestResult: { error: "1042 잔액 부족." } }).blocks
    ).join("\n");
    expect(c).toContain("*⚠ 게스트 알림 실패 — 1042 잔액 부족 · 어드민에서 재발송*");
  });

  it("게스트 성공은 경고가 아니다", () => {
    const c = contextTexts(buildHostBlocks("received", salon, { at, guestResult: "ok" }).blocks).join("\n");
    expect(c).not.toContain("⚠");
    expect(c).toContain("게스트");
  });

  it("게스트 건너뜀은 사유를 그대로 보여준다", () => {
    const c = contextTexts(
      buildHostBlocks("confirmed", salon, { at, guestResult: "skipped", guestSkipReason: "연락처 없음" })
        .blocks
    ).join("\n");
    expect(c).toContain("연락처 없음");
    expect(c).not.toContain("⚠");
  });

  it("취소는 환불 안내를, 접수는 입금확인 안내를 덧붙인다", () => {
    expect(contextTexts(buildHostBlocks("cancelled", salon, { at }).blocks).join("\n")).toContain(
      "환불"
    );
    expect(contextTexts(buildHostBlocks("received", salon, { at }).blocks).join("\n")).toContain(
      "입금확인"
    );
  });
});

describe("buildHostBlocks — actions", () => {
  it("어드민 열기 버튼이 목록 탭으로 간다", () => {
    const urls = actionUrls(buildHostBlocks("received", salon, { at }).blocks);
    expect(urls).toContain("https://koinonia-web.vercel.app/admin?tab=list");
  });
});

describe("buildHostBlocks — fallback text", () => {
  it("text는 기존 호스트 문자(buildHostMessage)의 본문 그대로다", () => {
    for (const event of ["received", "confirmed", "cancelled"] as const) {
      for (const b of [salon, stay]) {
        const ctx = { at, guestResult: "ok" as const };
        expect(buildHostBlocks(event, b, ctx).text).toBe(buildHostMessage(event, b, ctx).text);
      }
    }
  });
});

describe("buildSimpleBlocks", () => {
  it("제목은 header, 항목은 section fields, note는 context로 나간다", () => {
    const m = buildSimpleBlocks(
      "🏕 리트릿 신청",
      [
        { label: "이름", value: "김리트" },
        { label: "회차", value: "1회차" },
      ],
      "시트에서 확인해주세요"
    );
    expect(headerText(m.blocks)).toBe("🏕 리트릿 신청");
    expect(fieldTexts(m.blocks).join("\n")).toContain("김리트");
    expect(fieldTexts(m.blocks).join("\n")).toContain("1회차");
    expect(contextTexts(m.blocks).join("\n")).toContain("시트에서 확인해주세요");
  });

  it("note가 없으면 context 블록도 없다", () => {
    const m = buildSimpleBlocks("📦 일괄 처리", [{ label: "건수", value: "3건" }]);
    expect(m.blocks.some((b) => (b as Block).type === "context")).toBe(false);
  });

  it("fallback text에 제목과 항목이 모두 들어간다", () => {
    const m = buildSimpleBlocks("🚪 무료개방 신청", [{ label: "이름", value: "박무료" }]);
    expect(m.text).toContain("🚪 무료개방 신청");
    expect(m.text).toContain("이름: 박무료");
  });
});
