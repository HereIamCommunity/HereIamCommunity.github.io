import { NextResponse } from "next/server";

type DateRange = { start: string; end: string };

/** 방별 Airbnb iCal을 파싱해서 블록된 날짜 범위 반환 */
export async function GET() {
  const roomUrls: Record<string, string | undefined> = {
    nagnae: process.env.AIRBNB_ICAL_NAGNAE,
    oksun: process.env.AIRBNB_ICAL_OKSUN,
    yeutae: process.env.AIRBNB_ICAL_YEUTAE,
  };

  const result: Record<string, DateRange[]> = {};

  await Promise.all(
    Object.entries(roomUrls).map(async ([room, url]) => {
      if (!url) { result[room] = []; return; }
      try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const text = await res.text();
        result[room] = parseIcal(text);
      } catch {
        result[room] = [];
      }
    })
  );

  return NextResponse.json(result);
}

function parseIcal(text: string): DateRange[] {
  const ranges: DateRange[] = [];
  const events = text.split("BEGIN:VEVENT");
  events.shift();

  for (const event of events) {
    const startMatch = event.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
    const endMatch = event.match(/DTEND(?:;VALUE=DATE)?:(\d{8})/);
    if (!startMatch || !endMatch) continue;

    const start = formatDate(startMatch[1]);
    // Airbnb DTEND는 exclusive — 하루 빼서 실제 마지막 날로
    const end = subtractDay(formatDate(endMatch[1]));
    ranges.push({ start, end });
  }

  return ranges;
}

function formatDate(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function subtractDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
