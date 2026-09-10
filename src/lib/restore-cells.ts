/**
 * 예약 행의 상태(N)·알림(O) 셀을 지정 값으로 되돌리는 일괄 복원 — 순수 파싱/검증.
 * 일괄 처리를 되돌릴 때 쓴다. 쓸 수 있는 열은 N·O 두 개뿐이다.
 */
import { normalizeRowRef, refCellRange, type RowRef } from "@/lib/row-ref";

export type RestoreItem = { ref: RowRef; status: string; notify: string };
export type RestoreParse =
  | { ok: true; items: RestoreItem[] }
  | { ok: false; error: string };

const MAX_ITEMS = 500;

export function parseRestoreRequest(body: unknown): RestoreParse {
  const b = (body ?? {}) as { items?: unknown };
  if (!Array.isArray(b.items) || b.items.length === 0) return { ok: false, error: "복원할 항목이 없습니다." };
  if (b.items.length > MAX_ITEMS) return { ok: false, error: `한 번에 ${MAX_ITEMS}건까지만 복원할 수 있습니다.` };
  const items: RestoreItem[] = [];
  for (const raw of b.items as unknown[]) {
    const it = (raw ?? {}) as { ref?: unknown; status?: unknown; notify?: unknown };
    const ref = normalizeRowRef(it.ref);
    if (!ref || (ref.tab !== "살롱" && ref.tab !== "스테이")) return { ok: false, error: "잘못된 행 참조가 있습니다." };
    items.push({ ref, status: typeof it.status === "string" ? it.status : "", notify: typeof it.notify === "string" ? it.notify : "" });
  }
  return { ok: true, items };
}

/** Sheets values.batchUpdate 용 data 배열 — N(상태)·O(알림) 두 셀씩 */
export function toBatchData(items: RestoreItem[]): { range: string; values: string[][] }[] {
  return items.flatMap((it) => [
    { range: refCellRange(it.ref, "N"), values: [[it.status]] },
    { range: refCellRange(it.ref, "O"), values: [[it.notify]] },
  ]);
}
