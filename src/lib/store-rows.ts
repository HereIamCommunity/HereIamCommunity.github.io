/**
 * DB 레코드 ↔ 화면·로직이 쓰는 행(`string[]`) 변환 — 순수 로직.
 *
 * 2026-09-19 구글 시트 → Supabase 이전. 행 모양(열 순서)은 시트와 똑같이 유지한다 —
 * digest·stats·list-filter·bulk·관리자 화면이 `row[13]` 같은 인덱스로 읽기 때문이다.
 * DB 쿼리는 `store.ts`, 변환·매칭 규칙은 여기.
 */

import { formatKstDateTime, parseKstDateTime } from "@/lib/kst-datetime";
import { RETREAT_SESSIONS } from "@/lib/retreat-sessions";
import {
  BOOKING_HEADER,
  isBookingTab,
  type BookingPatch,
  type RowMeta,
  type SheetTab,
} from "@/lib/row-ref";

/* ─── 입력 타입 (라우트가 넘기는 값 — 시트 시절 그대로) ───── */

export type BookingRow = {
  type: string;         // salon | stay
  createdAt: string;    // "2026. 9. 6. 오후 7:10:32"
  name: string;
  phone: string;
  program?: string;     // 살롱 프로그램명
  date?: string;        // 날짜/일시
  room?: string;        // 스테이 객실명
  nights?: string;      // 박수
  checkIn?: string;
  checkOut?: string;
  discount: string;
  totalAmount: number;
  memo?: string;
  status: string;       // 신청 | 입금확인 | 취소
  notifyStatus?: string; // 게스트 알림 발송 결과 (✅ HH:MM / ❌ 실패)
};

export type RetreatRow = {
  createdAt: string;
  name: string;
  phone: string;
  grade: string;      // 학년/나이
  region: string;     // 거주 지역
  session: string;    // s1~s5
  referral: string;   // 추천인
  question: string;   // 궁금한 점
  memo: string;       // 요청사항
  allergy: string;    // 음식 알레르기
  care: string;       // 특별 케어 사항
  parentNote: string; // 부모님 고민·기대감
  status: string;     // 신청
};

export type OpenStayRow = {
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  groupType: string;  // 혼자 | 둘이 | 가족 | 팀/모임
  groupSize: string;
  reason: string;
  contribution: string; // 쉼표 구분 복수 선택
  message: string;
  status: string; // 신청 | 확정 | 취소
};

export type BookingCheckResult = {
  type: "살롱" | "스테이";
  createdAt: string;
  name: string;
  program: string;    // 살롱: 프로그램명, 스테이: 객실명
  date: string;       // 살롱: 일시, 스테이: 체크인~체크아웃
  amount: string;
  status: string;
};

/* ─── DB 레코드 ─────────────────────────────────── */

export type BookingKind = "salon" | "stay";

export type BookingRecord = {
  id: number;
  kind: BookingKind;
  created_at: string | null;
  name: string;
  phone: string;
  program: string;
  date_text: string;
  room: string;
  nights: string;
  check_in: string;
  check_out: string;
  discount: string;
  total_amount: number | null;
  memo: string;
  status: string;
  notify_status: string;
};

export type RetreatRecord = {
  id: number;
  created_at: string | null;
  name: string;
  phone: string;
  grade: string;
  region: string;
  session: string;
  referral: string;
  question: string;
  memo: string;
  allergy: string;
  care: string;
  parent_note: string;
  status: string;
};

export type OpenStayRecord = {
  id: number;
  created_at: string | null;
  name: string;
  phone: string;
  email: string;
  check_in: string;
  check_out: string;
  group_type: string;
  group_size: string;
  reason: string;
  contribution: string;
  message: string;
  status: string;
};

export const BOOKING_COLUMNS =
  "id,kind,created_at,name,phone,program,date_text,room,nights,check_in,check_out,discount,total_amount,memo,status,notify_status";
export const RETREAT_COLUMNS =
  "id,created_at,name,phone,grade,region,session,referral,question,memo,allergy,care,parent_note,status";
export const OPEN_STAY_COLUMNS =
  "id,created_at,name,phone,email,check_in,check_out,group_type,group_size,reason,contribution,message,status";

export const RETREAT_HEADER = [
  "신청일시","이름","연락처","학년나이","거주지역","회차","추천인","궁금한점","요청사항","알레르기","케어사항","부모님메모","상태",
];
export const OPEN_STAY_HEADER = [
  "신청일시","이름","연락처","이메일","체크인","체크아웃","방문형태","인원","방문이유","기여방법","응원메시지","상태",
];

export const KIND_TAB: Record<BookingKind, "살롱" | "스테이"> = { salon: "살롱", stay: "스테이" };

/* ─── 레코드 → 행 ───────────────────────────────── */

function createdText(iso: string | null): string {
  return iso ? formatKstDateTime(new Date(iso)) : "";
}

/** 예약 A~O: 신청일시 구분 이름 연락처 프로그램 일시 객실 박수 체크인 체크아웃 할인 결제금액 요청사항 상태 알림 */
export function bookingToRow(r: BookingRecord): string[] {
  return [
    createdText(r.created_at), KIND_TAB[r.kind], r.name, r.phone, r.program, r.date_text,
    r.room, r.nights, r.check_in, r.check_out, r.discount,
    r.total_amount == null ? "" : String(r.total_amount),
    r.memo, r.status, r.notify_status,
  ];
}

/** 리트릿 A~M */
export function retreatToRow(r: RetreatRecord): string[] {
  return [
    createdText(r.created_at), r.name, r.phone, r.grade, r.region, r.session, r.referral,
    r.question, r.memo, r.allergy, r.care, r.parent_note, r.status,
  ];
}

/** 무료개방 A~L */
export function openStayToRow(r: OpenStayRecord): string[] {
  return [
    createdText(r.created_at), r.name, r.phone, r.email, r.check_in, r.check_out,
    r.group_type, r.group_size, r.reason, r.contribution, r.message, r.status,
  ];
}

const byIdAsc = <T extends { id: number }>(a: T, b: T) => a.id - b.id;

/**
 * 살롱 + 스테이 목록. 시트 시절 `mergeBookingRowsWithMeta`와 같은 순서:
 * 헤더 1줄 + 살롱 전체 + 스테이 전체(각각 추가된 순서 = id 오름차순).
 * meta는 rows와 **길이·순서가 같다**(meta[0]은 헤더 자리, id 0).
 */
export function buildBookingList(records: BookingRecord[]): { rows: string[][]; meta: RowMeta[] } {
  const sorted = [...records].sort(byIdAsc);
  const rows: string[][] = [[...BOOKING_HEADER]];
  const meta: RowMeta[] = [{ tab: "살롱", id: 0 }];
  for (const kind of ["salon", "stay"] as const) {
    for (const r of sorted) {
      if (r.kind !== kind) continue;
      rows.push(bookingToRow(r));
      meta.push({ tab: KIND_TAB[kind], id: r.id });
    }
  }
  return { rows, meta };
}

/** 리트릿·무료개방 목록 — 헤더 1줄 + id 오름차순. meta 규칙은 buildBookingList와 같다. */
export function buildSimpleList<T extends { id: number }>(
  records: T[],
  toRow: (r: T) => string[],
  header: string[],
  tab: SheetTab
): { rows: string[][]; meta: RowMeta[] } {
  const rows: string[][] = [[...header]];
  const meta: RowMeta[] = [{ tab, id: 0 }];
  for (const r of [...records].sort(byIdAsc)) {
    rows.push(toRow(r));
    meta.push({ tab, id: r.id });
  }
  return { rows, meta };
}

/* ─── 입력 → 레코드 ─────────────────────────────── */

function createdIso(s: string): string | null {
  const d = parseKstDateTime(s);
  return d ? d.toISOString() : null;
}

function discountLabel(code: string): string {
  if (code === "geot") return "멤버십 곁 (-20%)";
  if (code === "nagnae") return "나그네방 후원자 (-30%)";
  return "없음";
}

function amountOrNull(v: unknown): number | null {
  const n = Number(v);
  return v !== undefined && v !== null && v !== "" && Number.isFinite(n) ? Math.round(n) : null;
}

export function bookingInsert(row: BookingRow): Omit<BookingRecord, "id"> {
  return {
    kind: row.type === "salon" ? "salon" : "stay",
    created_at: createdIso(row.createdAt),
    name: row.name ?? "",
    phone: row.phone ?? "",
    program: row.program ?? "",
    date_text: row.date ?? "",
    room: row.room ?? "",
    nights: row.nights ?? "",
    check_in: row.checkIn ?? "",
    check_out: row.checkOut ?? "",
    discount: discountLabel(row.discount),
    total_amount: amountOrNull(row.totalAmount),
    memo: row.memo ?? "",
    status: row.status,
    notify_status: row.notifyStatus ?? "",
  };
}

export function retreatInsert(row: RetreatRow): Omit<RetreatRecord, "id"> {
  return {
    created_at: createdIso(row.createdAt),
    name: row.name,
    phone: row.phone,
    grade: row.grade,
    region: row.region,
    session: RETREAT_SESSIONS.find((s) => s.key === row.session)?.label ?? row.session,
    referral: row.referral,
    question: row.question,
    memo: row.memo,
    allergy: row.allergy,
    care: row.care,
    parent_note: row.parentNote,
    status: row.status,
  };
}

export function openStayInsert(row: OpenStayRow): Omit<OpenStayRecord, "id"> {
  return {
    created_at: createdIso(row.createdAt),
    name: row.name,
    phone: row.phone,
    email: row.email,
    check_in: row.checkIn,
    check_out: row.checkOut,
    group_type: row.groupType,
    group_size: row.groupSize,
    reason: row.reason,
    contribution: row.contribution,
    message: row.message,
    status: row.status,
  };
}

/* ─── 행 찾기 (ref가 없을 때의 옛 경로) ─────────── */

export function digitsOnly(p: string): string {
  return (p ?? "").replace(/\D/g, "");
}

/**
 * 시트 시절과 같은 순서: ① 신청일시(표시 문자열)가 같은 행 중 최신 ② 그냥 최신.
 * candidates는 이미 연락처 숫자로 좁힌 행이다. 최신 = id가 큰 행.
 */
export function pickByCreatedAtThenLatest<T extends { id: number; created_at: string | null }>(
  candidates: T[],
  createdAt: string
): T | null {
  const desc = [...candidates].sort((a, b) => b.id - a.id);
  return desc.find((r) => createdText(r.created_at) === createdAt) ?? desc[0] ?? null;
}

/* ─── 예약 확인 페이지 · 리트릿 인원 ────────────── */

/** 최신순. 신청일시가 없는 수기 입력 행은 시트 시절처럼 빼준다. */
export function bookingCheckResults(records: BookingRecord[]): BookingCheckResult[] {
  return [...records]
    .filter((r) => r.created_at)
    .sort((a, b) => b.id - a.id)
    .map((r) => {
      const row = bookingToRow(r);
      const type = KIND_TAB[r.kind];
      return {
        type,
        createdAt: row[0],
        name: r.name,
        program: type === "살롱" ? r.program : r.room,
        date: type === "살롱" ? r.date_text : `${r.check_in} ~ ${r.check_out} (${r.nights}박)`,
        amount: row[11],
        status: r.status || "신청",
      };
    });
}

/** 회차 라벨 목록 → { s1: 3, s2: 0, ... } (회차 정의는 RETREAT_SESSIONS 하나만 본다) */
export function retreatCounts(sessionLabels: string[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(RETREAT_SESSIONS.map((s) => [s.key, 0]));
  const keyOf: Record<string, string> = Object.fromEntries(RETREAT_SESSIONS.map((s) => [s.label, s.key]));
  for (const label of sessionLabels) {
    const key = keyOf[label];
    if (key) counts[key] += 1;
  }
  return counts;
}

/* ─── 일괄 처리 ─────────────────────────────────── */

/** `apply_booking_patches`에 넘길 모양. 키가 없는 칸은 빼서 DB가 그대로 두게 한다. */
export function patchesPayload(
  patches: BookingPatch[]
): { id: number; status?: string; notify?: string }[] {
  return patches.map((p) => {
    if (!isBookingTab(p.ref.tab)) {
      throw new Error(`예약이 아닌 행은 일괄 처리할 수 없습니다: ${p.ref.tab} #${p.ref.id}`);
    }
    return {
      id: p.ref.id,
      ...(p.status !== undefined ? { status: p.status } : {}),
      ...(p.notify !== undefined ? { notify: p.notify } : {}),
    };
  });
}
