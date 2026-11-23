"use client";

import { useState } from "react";
import { normalizeDate } from "@/lib/digest";
import StatusBadge from "./StatusBadge";
import {
  BTN_OUTLINE,
  CARD,
  CARD_EMPTY,
  CARD_GRID,
  SECTION_H,
  ROOM_KEYS,
  ROOM_NAMES,
  bookingStatus,
  dayStatus,
  shortDate,
  telHref,
  toDateStr,
  type DateRange,
  type RoomKey,
  type Row,
} from "./shared";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const DOT_COLOR: Record<string, string> = {
  website: "bg-teal",
  airbnb: "bg-orange",
  both: "bg-brown",
  available: "bg-gray-200",
};

type UpcomingWeb = {
  type: "website";
  name: string;
  phone: string;
  room: string;
  checkIn: string;
  checkOut: string;
  row: Row;
};
type UpcomingAirbnb = {
  type: "airbnb";
  name: string;
  room: string;
  checkIn: string;
  checkOut: string;
};
type UpcomingItem = UpcomingWeb | UpcomingAirbnb;

const VALID_ROOMS = new Set(Object.values(ROOM_NAMES));

export default function StayCalendarTab({
  stayRows,
  airbnbRanges,
  todayISO,
}: {
  stayRows: Row[];
  airbnbRanges: Record<string, DateRange[]>;
  todayISO: string;
}) {
  const [year, setYear] = useState(() => Number(todayISO.slice(0, 4)));
  const [monthIndex, setMonthIndex] = useState(() => Number(todayISO.slice(5, 7)) - 1);

  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const shiftMonth = (delta: number) => {
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  };

  const upcomingWeb: UpcomingWeb[] = stayRows
    .filter((r) => VALID_ROOMS.has(r[6]) && r[8] && r[9] && normalizeDate(r[9]) >= todayISO)
    .map((r) => ({
      type: "website",
      name: r[2] ?? "",
      phone: r[3] ?? "",
      room: r[6] ?? "",
      checkIn: normalizeDate(r[8]),
      checkOut: normalizeDate(r[9]),
      row: r,
    }));

  const upcomingAirbnb: UpcomingAirbnb[] = ROOM_KEYS.flatMap((key) =>
    (airbnbRanges[key] ?? [])
      .filter((r) => normalizeDate(r.end) >= todayISO)
      .map((r) => {
        const nameMatch = r.summary?.match(/\((.+)\)/);
        return {
          type: "airbnb",
          name: nameMatch ? nameMatch[1] : "에어비앤비",
          room: ROOM_NAMES[key],
          checkIn: normalizeDate(r.start),
          checkOut: normalizeDate(r.end),
        };
      })
  );

  const allUpcoming: UpcomingItem[] = [...upcomingWeb, ...upcomingAirbnb].sort((a, b) =>
    a.checkIn.localeCompare(b.checkIn)
  );

  return (
    <div className="space-y-6">
      <div className={`${CARD_GRID} lg:grid-cols-2`}>
        {/* 캘린더 */}
        <div className={CARD}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="이전 달" className={BTN_OUTLINE}>
              이전
            </button>
            <h2 className={SECTION_H}>
              {year}년 {monthIndex + 1}월
            </h2>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="다음 달" className={BTN_OUTLINE}>
              다음
            </button>
          </div>

          <div className="grid grid-cols-7">
            {DOW.map((d) => (
              <div key={d} className="py-1 text-center text-xs text-gray-600">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} />;
              const dateStr = toDateStr(year, monthIndex, day);
              const isToday = dateStr === todayISO;
              const isPast = dateStr < todayISO;
              return (
                <div
                  key={dateStr}
                  className={`flex flex-col items-center justify-center rounded-md border border-gray-200 bg-white py-1.5 text-xs ${
                    isPast ? "opacity-40" : ""
                  } ${isToday ? "ring-2 ring-brown" : ""}`}
                >
                  <span className="tabular-nums text-gray-800">{day}</span>
                  <div className="mt-1 flex gap-px">
                    {ROOM_KEYS.map((key) => {
                      const s = dayStatus(stayRows, airbnbRanges, dateStr, key);
                      const label =
                        s === "available"
                          ? `${ROOM_NAMES[key]}: 예약 없음`
                          : s === "website"
                          ? `${ROOM_NAMES[key]}: 웹사이트 예약`
                          : s === "airbnb"
                          ? `${ROOM_NAMES[key]}: 에어비앤비 예약`
                          : `${ROOM_NAMES[key]}: 중복 주의`;
                      return (
                        <span
                          key={key}
                          title={label}
                          aria-label={label}
                          className={`h-1.5 w-1.5 rounded-sm ${DOT_COLOR[s]}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 범례 */}
          <div className="mt-4 space-y-2 text-xs text-gray-600">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-teal" />웹사이트
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-orange" />에어비앤비
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brown" />중복 주의
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-gray-200" />예약 없음
              </span>
            </div>
            <p className="text-gray-400">
              점 순서: 왼쪽 = 나그네방 &nbsp;·&nbsp; 가운데 = 옥순방 &nbsp;·&nbsp; 오른쪽 = 여태방
            </p>
          </div>
        </div>

        {/* 전체 다가오는 예약 */}
        <div className={CARD}>
          <h2 className={`${SECTION_H} mb-3`}>다가오는 예약 전체</h2>
          {allUpcoming.length === 0 ? (
            <p className={`${CARD_EMPTY} text-xs text-gray-700`}>다가오는 예약이 없어요.</p>
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
              {allUpcoming.map((item, i) => (
                <li
                  key={`${item.type}-${i}`}
                  className={`rounded-lg px-3 py-2.5 ${
                    item.type === "website" ? "bg-teal/5" : "bg-orange/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        item.type === "website" ? "bg-teal" : "bg-orange"
                      }`}
                    />
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-brown">
                      {item.name}
                    </span>
                    <span className="shrink-0 rounded bg-cream px-1.5 py-0.5 text-[10px] text-gray-600">
                      {item.room}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4">
                    <span className="whitespace-nowrap text-xs text-gray-700">
                      {shortDate(item.checkIn)} → {shortDate(item.checkOut)}
                    </span>
                    {item.type === "website" && item.phone && (
                      <a
                        href={telHref(item.phone)}
                        className="whitespace-nowrap text-xs text-teal-dark underline"
                      >
                        {item.phone}
                      </a>
                    )}
                    {item.type === "website" && (
                      <StatusBadge status={bookingStatus(item.row)} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
