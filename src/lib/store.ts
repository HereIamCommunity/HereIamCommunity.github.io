/**
 * 예약 데이터 저장소 — Supabase 쿼리 계층 (2026-09-19 `sheets.ts` 대체).
 *
 * 함수 이름·반환 모양은 시트 시절 그대로다: 목록은 헤더 1줄을 포함한 `string[][]` +
 * 같은 길이의 meta. 변환·매칭 규칙은 순수 모듈 `store-rows.ts`에 있고, 여기는 쿼리만 한다.
 *
 * - 전체 읽기는 반드시 `fetchAllPages`로 (Supabase는 1,000행에서 조용히 자른다).
 * - DB 오류는 "행 없음"으로 위장하지 않고 던진다(2026-09-10 429 → 404 오인 사례).
 *   예외: `getRetreatCounts`는 신청 페이지가 죽지 않게 0으로 채워 돌려준다.
 */

import { getDb } from "@/lib/supabase";
import { fetchAllPages, type PageResult } from "@/lib/paginate";
import { isBookingTab, type BookingPatch, type RowMeta, type RowRef } from "@/lib/row-ref";
import {
  BOOKING_COLUMNS,
  bookingCheckResults,
  bookingInsert,
  bookingToRow,
  buildBookingList,
  buildSimpleList,
  digitsOnly,
  KIND_TAB,
  OPEN_STAY_COLUMNS,
  OPEN_STAY_HEADER,
  openStayInsert,
  openStayToRow,
  patchesPayload,
  pickByCreatedAtThenLatest,
  RETREAT_COLUMNS,
  RETREAT_HEADER,
  retreatCounts,
  retreatInsert,
  retreatToRow,
  type BookingCheckResult,
  type BookingKind,
  type BookingRecord,
  type BookingRow,
  type OpenStayRecord,
  type OpenStayRow,
  type RetreatRecord,
  type RetreatRow,
} from "@/lib/store-rows";

export type { BookingCheckResult, BookingRow, OpenStayRow, RetreatRow } from "@/lib/store-rows";
export type { RowMeta, RowRef, SheetTab } from "@/lib/row-ref";

type Table = "bookings" | "retreats" | "open_stays";
type List = { rows: string[][]; meta: RowMeta[] };

/** 테이블 전체(또는 연락처 숫자로 좁힌 전체)를 id 순으로 끝까지 읽는다. */
function allRows<T>(table: Table, columns: string, phoneDigits?: string): Promise<T[]> {
  const db = getDb()!;
  return fetchAllPages<T>((from, to) => {
    const base = db.from(table).select(columns);
    const filtered = phoneDigits === undefined ? base : base.eq("phone_digits", phoneDigits);
    return filtered.order("id", { ascending: true }).range(from, to) as unknown as PromiseLike<PageResult<T>>;
  });
}

async function byId<T>(table: Table, columns: string, id: number): Promise<T | null> {
  const { data, error } = await getDb()!.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as T | null) ?? null;
}

async function updateById(table: Table, id: number, values: Record<string, string>): Promise<boolean> {
  const { data, error } = await getDb()!.from(table).update(values).eq("id", id).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** columns는 삽입 후 되받을 컬럼 목록 — bookings만 kind가 있다("id,kind"), 나머지는 "id". */
async function insertOne(
  table: Table,
  values: object,
  columns: string
): Promise<{ id: number; kind?: BookingKind }> {
  const { data, error } = await getDb()!.from(table).insert(values).select(columns).single();
  if (error) throw error;
  // columns가 리터럴이 아닌 변수라 supabase-js가 결과 타입을 좁히지 못한다 — 값은 실제로 맞다.
  return data as unknown as { id: number; kind?: BookingKind };
}

/* ─── 쓰기 ─────────────────────────────────────── */

/** 예약 저장. 새 행의 ref를 돌려준다 — 알림 결과를 바로 이 행에 기록하려고. */
export async function appendBooking(row: BookingRow): Promise<RowRef | null> {
  if (!getDb()) {
    console.warn("[DB] 환경변수 미설정 — 예약 저장 건너뜀");
    return null;
  }
  const saved = await insertOne("bookings", bookingInsert(row), "id,kind");
  return { tab: KIND_TAB[saved.kind ?? "stay"], id: saved.id };
}

export async function appendRetreat(row: RetreatRow): Promise<RowRef | null> {
  if (!getDb()) {
    console.warn("[DB] 환경변수 미설정 — 리트릿 저장 건너뜀");
    return null;
  }
  const saved = await insertOne("retreats", retreatInsert(row), "id");
  return { tab: "리트릿", id: saved.id };
}

export async function appendOpenStay(row: OpenStayRow): Promise<RowRef | null> {
  if (!getDb()) {
    console.warn("[DB] 환경변수 미설정 — 무료개방 저장 건너뜀");
    return null;
  }
  const saved = await insertOne("open_stays", openStayInsert(row), "id");
  return { tab: "무료개방", id: saved.id };
}

/* ─── 목록 ─────────────────────────────────────── */

/** 살롱 + 스테이 (어드민/cron용). 헤더는 첫 행 한 번만 포함 */
export async function getAllBookings(): Promise<string[][]> {
  return (await getAllBookingsWithMeta()).rows;
}

/** getAllBookings + 각 행의 ref. meta는 rows와 **길이·순서가 같다** (meta[0]은 헤더 자리). */
export async function getAllBookingsWithMeta(): Promise<List> {
  if (!getDb()) return { rows: [], meta: [] };
  return buildBookingList(await allRows<BookingRecord>("bookings", BOOKING_COLUMNS));
}

export async function getAllRetreats(): Promise<string[][]> {
  return (await getAllRetreatsWithMeta()).rows;
}

export async function getAllRetreatsWithMeta(): Promise<List> {
  if (!getDb()) return { rows: [], meta: [] };
  const recs = await allRows<RetreatRecord>("retreats", RETREAT_COLUMNS);
  return buildSimpleList(recs, retreatToRow, RETREAT_HEADER, "리트릿");
}

export async function getAllOpenStays(): Promise<string[][]> {
  return (await getAllOpenStaysWithMeta()).rows;
}

export async function getAllOpenStaysWithMeta(): Promise<List> {
  if (!getDb()) return { rows: [], meta: [] };
  const recs = await allRows<OpenStayRecord>("open_stays", OPEN_STAY_COLUMNS);
  return buildSimpleList(recs, openStayToRow, OPEN_STAY_HEADER, "무료개방");
}

/** 회차별 신청 인원 { s1: 3, s2: 0, ... }. 오류 시 전부 0 (신청 페이지가 죽지 않게). */
export async function getRetreatCounts(): Promise<Record<string, number>> {
  if (!getDb()) return retreatCounts([]);
  try {
    const recs = await allRows<{ id: number; session: string }>("retreats", "id,session");
    return retreatCounts(recs.map((r) => r.session));
  } catch (e) {
    console.error("[DB] 리트릿 인원 집계 실패", e);
    return retreatCounts([]);
  }
}

/** 예약 확인 페이지 — 연락처(숫자만 비교)로 찾은 살롱·스테이, 최신순 */
export async function getBookingsByPhone(phone: string): Promise<BookingCheckResult[]> {
  const target = digitsOnly(phone);
  if (!target || !getDb()) return [];
  return bookingCheckResults(await allRows<BookingRecord>("bookings", BOOKING_COLUMNS, target));
}

/* ─── 예약 한 건 찾기·갱신 ─────────────────────── */

/**
 * ref가 예약 탭을 가리키면 id로 바로. 없거나 그 행이 없으면 옛 경로:
 * 연락처 숫자로 좁힌 뒤 ① 신청일시 일치 ② 최신. 연락처가 비면 찾지 않는다.
 */
async function findBooking(
  type: string,
  createdAt: string,
  phone: string,
  ref?: RowRef
): Promise<BookingRecord | null> {
  if (!getDb()) return null;
  if (ref && isBookingTab(ref.tab)) {
    const hit = await byId<BookingRecord>("bookings", BOOKING_COLUMNS, ref.id);
    if (hit) return hit;
  }
  const target = digitsOnly(phone);
  if (!target) return null;
  const kind: BookingKind = type === "salon" || type === "살롱" ? "salon" : "stay";
  const candidates = (await allRows<BookingRecord>("bookings", BOOKING_COLUMNS, target)).filter(
    (r) => r.kind === kind
  );
  return pickByCreatedAtThenLatest(candidates, createdAt);
}

/** 예약 행(A~O)을 그대로 반환. 현재 상태 확인용. */
export async function getBookingRow(
  type: string,
  createdAt: string,
  phone: string,
  ref?: RowRef
): Promise<string[] | null> {
  const rec = await findBooking(type, createdAt, phone, ref);
  return rec ? bookingToRow(rec) : null;
}

/** 알림 발송 결과를 '알림' 칸에 기록 */
export async function updateNotifyStatus(
  type: string,
  createdAt: string,
  phone: string,
  status: string,
  ref?: RowRef
): Promise<boolean> {
  const rec = await findBooking(type, createdAt, phone, ref);
  return rec ? updateById("bookings", rec.id, { notify_status: status }) : false;
}

/** '상태' 칸 갱신 */
export async function updateBookingStatus(
  type: string,
  createdAt: string,
  phone: string,
  status: string,
  ref?: RowRef
): Promise<boolean> {
  const rec = await findBooking(type, createdAt, phone, ref);
  return rec ? updateById("bookings", rec.id, { status }) : false;
}

/** '요청사항'에 한 줄 덧붙인다 (취소 사유 등). 기존 내용은 지우지 않는다. */
export async function appendBookingMemo(
  type: string,
  createdAt: string,
  phone: string,
  text: string,
  ref?: RowRef
): Promise<boolean> {
  if (!text) return false;
  const rec = await findBooking(type, createdAt, phone, ref);
  if (!rec) return false;
  const prev = (rec.memo ?? "").trim();
  return updateById("bookings", rec.id, { memo: prev ? `${prev}\n${text}` : text });
}

/* ─── 리트릿·무료개방 상태 ─────────────────────── */

async function findSimple<T extends { id: number; created_at: string | null }>(
  table: "retreats" | "open_stays",
  columns: string,
  tab: "리트릿" | "무료개방",
  createdAt: string,
  phone: string,
  ref?: RowRef
): Promise<T | null> {
  if (!getDb()) return null;
  if (ref?.tab === tab) {
    const hit = await byId<T>(table, columns, ref.id);
    if (hit) return hit;
  }
  const target = digitsOnly(phone);
  if (!target) return null;
  return pickByCreatedAtThenLatest(await allRows<T>(table, columns, target), createdAt);
}

export async function updateRetreatStatus(
  createdAt: string,
  phone: string,
  status: string,
  ref?: RowRef
): Promise<boolean> {
  const rec = await findSimple<RetreatRecord>("retreats", RETREAT_COLUMNS, "리트릿", createdAt, phone, ref);
  return rec ? updateById("retreats", rec.id, { status }) : false;
}

export async function updateOpenStayStatus(
  createdAt: string,
  phone: string,
  status: string,
  ref?: RowRef
): Promise<boolean> {
  const rec = await findSimple<OpenStayRecord>("open_stays", OPEN_STAY_COLUMNS, "무료개방", createdAt, phone, ref);
  return rec ? updateById("open_stays", rec.id, { status }) : false;
}

/* ─── 일괄 처리 ─────────────────────────────────── */

/**
 * 예약 여러 건의 상태·알림 칸을 **한 트랜잭션**으로 바꾼다(DB 함수 `apply_booking_patches`).
 * 없는 id가 하나라도 있으면 전체가 롤백되고 오류를 던진다. 반환: 갱신된 행 수.
 */
export async function applyPatches(patches: BookingPatch[]): Promise<number> {
  if (patches.length === 0) return 0;
  const db = getDb();
  if (!db) return 0;
  const { data, error } = await db.rpc("apply_booking_patches", { patches: patchesPayload(patches) });
  if (error) throw error;
  return Number(data ?? 0);
}
