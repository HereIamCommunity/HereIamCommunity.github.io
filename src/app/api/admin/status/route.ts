import { NextRequest, NextResponse } from "next/server";
import { parseAdminRow } from "@/lib/admin-row";
import { resolveStatusAction } from "@/lib/admin-actions";
import { notifyBooking } from "@/lib/messaging";
import {
  appendBookingMemo,
  getBookingRow,
  updateBookingStatus,
  updateOpenStayStatus,
  updateRetreatStatus,
} from "@/lib/sheets";

/**
 * 어드민에서 신청 상태를 바꾼다 (입금확인 / 취소 / 되돌리기).
 *
 * body: { sheet?: "booking" | "retreat" | "open"; row: string[]; action: "confirm" | "cancel" | "reopen"; reason?: string }
 * res:  { ok: true; status: string; notify?: NotifyResult } | { ok: false; error: string; status?: string }
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
    const {
      sheet = "booking",
      row,
      action,
      reason,
    } = (await req.json()) as {
      sheet?: string;
      row: string[];
      action: string;
      reason?: string;
    };

    if (!Array.isArray(row) || row.length === 0) {
      return NextResponse.json({ ok: false, error: "신청 정보가 없습니다." }, { status: 400 });
    }
    // 시트를 읽기 전에 액션부터 거른다 (잘못된 요청에 시트 왕복 낭비 방지)
    if (!["confirm", "cancel", "reopen"].includes(action)) {
      return NextResponse.json({ ok: false, error: "알 수 없는 동작입니다." }, { status: 400 });
    }

    if (sheet === "retreat" || sheet === "open") {
      return handleSimpleSheet(sheet, row, action);
    }
    if (sheet !== "booking") {
      return NextResponse.json({ ok: false, error: "알 수 없는 시트입니다." }, { status: 400 });
    }

    /* ── 예약(살롱·스테이) ── */
    if (!row[3]) {
      return NextResponse.json({ ok: false, error: "예약 정보가 없습니다." }, { status: 400 });
    }

    const booking = parseAdminRow(row);

    // 현재 시트 상태 확인 (중복 처리 방지)
    const current = await getBookingRow(booking.type, booking.createdAt ?? "", booking.phone);
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
      resolved.status
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
          `[취소사유] ${reason.trim()}`
        );
      } catch (e) {
        console.error("[STATUS] 취소 사유 기록 실패", e);
      }
    }

    if (!resolved.event) {
      return NextResponse.json({ ok: true, status: resolved.status });
    }

    const notify = await notifyBooking(resolved.event, booking);
    return NextResponse.json({ ok: true, status: resolved.status, notify });
  } catch (e) {
    console.error("[STATUS ERROR]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * 리트릿·무료개방: 알림 없이 상태만 바꾼다.
 * 행 식별은 신청일시(A) + 연락처(C). 상태 열은 리트릿 M(12), 무료개방 L(11).
 */
async function handleSimpleSheet(sheet: "retreat" | "open", row: string[], action: string) {
  const createdAt = row[0] ?? "";
  const phone = row[2] ?? "";
  if (!phone) {
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
      ? await updateRetreatStatus(createdAt, phone, resolved.status)
      : await updateOpenStayStatus(createdAt, phone, resolved.status);

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "시트에서 신청 행을 찾지 못했습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, status: resolved.status });
}
