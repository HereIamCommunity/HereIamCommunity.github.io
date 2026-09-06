import { NextRequest, NextResponse } from "next/server";
import { getAllBookings } from "@/lib/sheets";

const ROOM_MAP: Record<string, string> = {
  nagnae: "나그네방",
  oksun: "옥순방",
  yeutae: "여태방",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // "oksun.ics" → "oksun"
  const roomId = filename.replace(/\.ics$/, "");
  const roomName = ROOM_MAP[roomId];

  if (!roomName) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rows = await getAllBookings();

  // 헤더 행 제외, 스테이 + 해당 방 + 취소 아닌 건만
  const bookings = rows.slice(1).filter((row) => {
    const type = row[1];       // 살롱 | 스테이
    const room = row[6];       // 객실명
    const status = row[13];    // 신청 | 입금확인 | 취소
    return type === "스테이" && room === roomName && status !== "취소";
  });

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const events = bookings.map((row, i) => {
    const checkIn = row[8]?.replace(/-/g, "") ?? "";   // YYYYMMDD
    const checkOut = row[9]?.replace(/-/g, "") ?? "";  // YYYYMMDD (exclusive in iCal)
    const uid = `koinonia-${roomId}-${i}-${checkIn}@koinonia-web.vercel.app`;

    if (!checkIn || !checkOut) return "";

    // checkOut은 iCal exclusive (체크아웃 날 +1일)
    const checkOutDate = new Date(row[9] + "T00:00:00");
    checkOutDate.setDate(checkOutDate.getDate() + 1);
    const checkOutExclusive = [
      checkOutDate.getFullYear(),
      String(checkOutDate.getMonth() + 1).padStart(2, "0"),
      String(checkOutDate.getDate()).padStart(2, "0"),
    ].join("");

    return [
      "BEGIN:VEVENT",
      `DTSTART;VALUE=DATE:${checkIn}`,
      `DTEND;VALUE=DATE:${checkOutExclusive}`,
      "SUMMARY:Koinonia Stay - Reserved",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ].join("\r\n");
  }).filter(Boolean);

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Koinonia//Koinonia Stay//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Koinonia ${roomId}`,
    "X-WR-TIMEZONE:Asia/Seoul",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${roomId}.ics"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}
