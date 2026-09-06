/**
 * 어드민 상태 변경의 판정 로직 (순수 함수).
 *
 * "현재 상태 × 액션" → 허용 여부 · 새 상태 · 보낼 알림.
 * 시트 I/O와 분리해 두고 라우트(`/api/admin/status`)는 이 결과를 그대로 따른다.
 */

import type { BookingEvent } from "@/lib/kakao";
import { isPending } from "@/lib/digest";

export type AdminSheet = "booking" | "retreat" | "open";
export type AdminAction = "confirm" | "cancel" | "reopen";

export type StatusResolution =
  | { ok: true; status: string; event: BookingEvent | null }
  | { ok: false; error: string; httpStatus: 400 | 409 };

/** 시트별 액션 → 저장할 상태. 알림은 예약(booking)에서만 나간다. */
const TARGETS: Record<AdminSheet, Record<AdminAction, { status: string; event: BookingEvent | null }>> = {
  booking: {
    confirm: { status: "입금확인", event: "confirmed" },
    cancel: { status: "취소", event: "cancelled" },
    reopen: { status: "신청", event: null },
  },
  retreat: {
    confirm: { status: "입금확인", event: null },
    cancel: { status: "취소", event: null },
    reopen: { status: "신청", event: null },
  },
  open: {
    confirm: { status: "확정", event: null },
    cancel: { status: "취소", event: null },
    reopen: { status: "신청", event: null },
  },
};

export function isAdminSheet(v: string): v is AdminSheet {
  return v === "booking" || v === "retreat" || v === "open";
}

export function resolveStatusAction(
  sheet: string,
  currentStatus: string,
  action: string
): StatusResolution {
  if (!isAdminSheet(sheet)) {
    return { ok: false, error: "알 수 없는 시트입니다.", httpStatus: 400 };
  }
  const target = TARGETS[sheet][action as AdminAction];
  if (!target) {
    return { ok: false, error: "알 수 없는 동작입니다.", httpStatus: 400 };
  }

  const current = (currentStatus ?? "").trim();

  if (current === target.status) {
    return { ok: false, error: `이미 '${target.status}' 상태입니다.`, httpStatus: 409 };
  }
  // 빈값도 '신청'과 같은 뜻이라 되돌릴 것이 없다.
  if (action === "reopen" && isPending(current)) {
    return { ok: false, error: "이미 '신청' 상태입니다.", httpStatus: 409 };
  }
  // 예약의 입금확인은 '신청'(또는 빈값) 행에서만.
  // 결제완료(토스 승인)·취소 행에 confirm이 오면 상태 하향 + 확정 알림 중복이라 막는다.
  // 되돌리려면 reopen을 먼저 쓴다.
  if (sheet === "booking" && action === "confirm" && !isPending(current)) {
    return {
      ok: false,
      error: `'${current}' 상태는 입금확인으로 바꿀 수 없습니다. 되돌리기 후 다시 시도해주세요.`,
      httpStatus: 409,
    };
  }

  return { ok: true, status: target.status, event: target.event };
}
