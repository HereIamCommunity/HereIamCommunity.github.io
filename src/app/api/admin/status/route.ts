import { NextRequest, NextResponse } from "next/server";
import { parseAdminRow } from "@/lib/admin-row";
import { parseStatusRequest, resolveStatusAction } from "@/lib/admin-actions";
import { notifyBooking, silentStatusText } from "@/lib/messaging";
import type { RowRef } from "@/lib/row-ref";
import {
  appendBookingMemo,
  getBookingRow,
  updateBookingStatus,
  updateOpenStayStatus,
  updateRetreatStatus,
  updateNotifyStatus,
} from "@/lib/sheets";

/**
 * 어드민에서 신청 상태를 바꾼다 (입금확인 / 취소 / 되돌리기).
 *
 * body: { sheet?: "booking" | "retreat" | "open"; row: string[]; action: "confirm" | "cancel" | "reopen";
 *         reason?: string; ref?: { tab: "살롱"|"스테이"|"리트릿"|"무료개방"; rowNum: number } }
 * res:  { ok: true; status: string; notify?: NotifyResult } | { ok: false; error: string; status?: string }
 *
 * ref(목록 응답의 meta 원소)가 있으면 시트 행 번호로 직접 읽고 쓴다 — 연락처가 빈 행도 처리된다.
 * 없으면 기존 방식(신청일시 + 연락처 탐색). 연락처는 더 이상 필수가 아니다.
 *
 * 알림(알림톡/문자)은 예약(booking)에서만 나간다. reopen은 어느 시트든 알림 없음.
 * 이미 같은 상태거나 허용되지 않는 전이면 409 (중복 클릭 방지).
 */

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = parseStatusRequest(await req.json());
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: parsed.httpStatus }
      );
    }
    const { sheet, row, action, reason, ref, notify: wantNotify } = parsed.value;

    if (sheet === "retreat" || sheet === "open") {
      return handleSimpleSheet(sheet, row, action, ref);
    }

    /* ── 예약(살롱·스테이) ── */
    const booking = parseAdminRow(row);

    // 현재 시트 상태 확인 (중복 처리 방지)
    const current = await getBookingRow(booking.type, booking.createdAt ?? "", booking.phone, ref);
    if (!current) {
      return NextResponse.json(
        { ok: false, error: "시트에서 예약 행을 찾지 못했습니다." },
        { status: 404 }
      );
    }
    const currentStatus = (current[13] ?? "").trim();

    const resolved = resolveStatusAction("booking", currentStatus, action);
    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, error: resolved.error, status: currentStatus },
        { status: resolved.httpStatus }
      );
    }

    const updated = await updateBookingStatus(
      booking.type,
      booking.createdAt ?? "",
      booking.phone,
      resolved.status,
      ref
    );
    if (!updated) {
      return NextResponse.json({ ok: false, error: "상태 저장에 실패했습니다." }, { status: 500 });
    }

    // 취소 사유는 요청사항(M열)에 남긴다. 실패해도 상태 변경은 이미 끝났으니 막지 않는다.
    if (action === "cancel" && reason?.trim()) {
      try {
        await appendBookingMemo(
          booking.type,
          booking.createdAt ?? "",
          booking.phone,
          `[취소사유] ${reason.trim()}`,
          ref
        );
      } catch (e) {
        console.error("[STATUS] 취소 사유 기록 실패", e);
      }
    }

    if (!resolved.event || !wantNotify) {
      // notify:false — 일괄 정리 등 알림 없이 상태만 바꿀 때. O열엔 "🔕 HH:MM 확정 알림 없음"을 남긴다.
      if (!wantNotify && resolved.event) {
        try {
          await updateNotifyStatus(booking.type, booking.createdAt ?? "", booking.phone, silentStatusText(resolved.event), ref);
        } catch (e) {
          console.error("[STATUS] 알림 없음 기록 실패", e);
        }
      }
      return NextResponse.json({ ok: true, status: resolved.status, notify: wantNotify ? undefined : { guest: "skipped", host: "skipped", guestSkipReason: "알림 없이 처리" } });
    }

    // 연락처가 없으면 게스트 알림만 skipped(사유 "연락처 없음")이 되고 호스트 문자는 그대로 나간다.
    const notify = await notifyBooking(resolved.event, booking, { ref });
    return NextResponse.json({ ok: true, status: resolved.status, notify });
  } catch (e) {
    console.error("[STATUS ERROR]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * 리트릿·무료개방: 알림 없이 상태만 바꾼다.
 * 행 식별은 ref(시트 행 번호) 우선, 없으면 신청일시(A) + 연락처(C).
 * 상태 열은 리트릿 M(12), 무료개방 L(11).
 */
async function handleSimpleSheet(
  sheet: "retreat" | "open",
  row: string[],
  action: string,
  ref?: RowRef
) {
  const createdAt = row[0] ?? "";
  const phone = row[2] ?? "";
  if (!phone && !ref) {
    return NextResponse.json({ ok: false, error: "신청 정보가 없습니다." }, { status: 400 });
  }

  const statusCol = sheet === "retreat" ? 12 : 11;
  const currentStatus = (row[statusCol] ?? "").trim();

  const resolved = resolveStatusAction(sheet, currentStatus, action);
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, error: resolved.error, status: currentStatus },
      { status: resolved.httpStatus }
    );
  }

  const updated =
    sheet === "retreat"
      ? await updateRetreatStatus(createdAt, phone, resolved.status, ref)
      : await updateOpenStayStatus(createdAt, phone, resolved.status, ref);

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "시트에서 신청 행을 찾지 못했습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, status: resolved.status });
}
