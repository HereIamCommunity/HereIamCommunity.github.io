"use client";

import { useState } from "react";
import { normalizeDate } from "@/lib/digest";
import StatusBadge from "./StatusBadge";
import {
  BTN_BASE,
  BTN_OUTLINE,
  CARD,
  CARD_EMPTY,
  CARD_GRID,
  SECTION_H,
  ROOM_KEYS,
  ROOM_NAMES,
  bookingStatus,
  dayStatus,
  isoOf,
  shortDate,
  telHref,
  toDateStr,
  type DateRange,
  type RoomKey,
  type Row,
} from "./shared";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const CELL: Record<string, { box: string; label: string; marker: string }> = {
  website: { box: "bg-teal text-white", label: "웹사이트 예약", marker: "●" },
  airbnb: { box: "bg-orange text-brown", label: "에어비앤비 예약", marker: "▲" },
  both: { box: "bg-brown text-cream", label: "중복 주의 (웹사이트+에어비앤비)", marker: "★" },
  available: { box: "bg-white text-brown", label: "예약 없음", marker: "" },
};

/** 스테이 캘린더 — 방별 웹/에어비앤비 점유와 다가오는 예약 */
export default function StayCalendarTab({
  stayRows,
  airbnbRanges,
  todayISO,
}: {
  stayRows: Row[];
  airbnbRanges: Record<string, DateRange[]>;
  todayISO: string;
}) {
  const [room, setRoom] = useState<RoomKey>("nagnae");
  const [year, setYear] = useState(() => Number(todayISO.slice(0, 4)));
  const [monthIndex, setMonthIndex] = useState(() => Number(todayISO.slice(5, 7)) - 1);

  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const roomName = ROOM_NAMES[room];
  const upcoming = stayRows
    .filter((r) => r[6] === roomName && r[9] && normalizeDate(r[9]) >= todayISO)
    .sort((a, b) => normalizeDate(a[8]).localeCompare(normalizeDate(b[8])));
  const upcomingAirbnb = (airbnbRanges[room] ?? [])
    .filter((r) => normalizeDate(r.end) >= todayISO)
    .sort((a, b) => normalizeDate(a.start).localeCompare(normalizeDate(b.start)));

  const shiftMonth = (delta: number) => {
    const next = new Date(year, monthIndex + delta, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  };

  const [ty, tm, td] = todayISO.split("-").map(Number);
  const in30 = isoOf(new Date(ty, tm - 1, td + 30));

  return (
    <div className="space-y-6">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">객실 선택</legend>
        {ROOM_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={room === key}
            onClick={() => setRoom(key)}
            className={`${BTN_BASE} border ${
              room === key ? "border-teal bg-teal text-white" : "border-gray-300 bg-white text-gray-700 hover:border-brown"
            }`}
          >
            {ROOM_NAMES[key]}
          </button>
        ))}
      </fieldset>

      <div className={`${CARD_GRID} lg:grid-cols-2`}>
        <div className={CARD}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="이전 달"
              className={BTN_OUTLINE}
            >
              이전
            </button>
            <h2 className={SECTION_H}>
              {year}년 {monthIndex + 1}월
            </h2>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="다음 달"
              className={BTN_OUTLINE}
            >
              다음
            </button>
          </div>

          <div className="grid grid-cols-7">
            {DOW.map((d) => (
              <div key={d} className="whitespace-nowrap py-1 text-center text-xs text-gray-600">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} />;
              const dateStr = toDateStr(year, monthIndex, day);
              const status = dayStatus(stayRows, airbnbRanges, dateStr, room);
              const isToday = dateStr === todayISO;
              const isPast = dateStr < todayISO;
              const c = CELL[status];
              return (
                <div
                  key={dateStr}
                  aria-label={`${monthIndex + 1}월 ${day}일 · ${roomName} · ${c.label}`}
                  title={`${monthIndex + 1}/${day} · ${roomName} · ${c.label}`}
                  className={`flex aspect-square flex-col items-center justify-center rounded-md border text-xs whitespace-nowrap ${
                    c.box
                  } ${status === "available" ? "border-gray-200" : "border-transparent"} ${
                    isPast ? "opacity-40" : ""
                  } ${isToday ? "ring-2 ring-brown" : ""}`}
                >
                  <span className="whitespace-nowrap tabular-nums">{day}</span>
                  {c.marker && (
                    <span aria-hidden="true" className="text-[8px] leading-none">
                      {c.marker}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-700">
            <li className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden="true" className="h-3 w-3 rounded bg-teal" />웹사이트 ●
            </li>
            <li className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden="true" className="h-3 w-3 rounded bg-orange" />에어비앤비 ▲
            </li>
            <li className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden="true" className="h-3 w-3 rounded bg-brown" />중복 주의 ★
            </li>
          </ul>
        </div>

        <div className={CARD}>
          <h2 className={`${SECTION_H} mb-3`}>{roomName} 다가오는 예약</h2>
          {upcoming.length === 0 && upcomingAirbnb.length === 0 ? (
            <p className={`${CARD_EMPTY} text-xs break-keep text-gray-700`}>
              이 방은 다가오는 예약이 없어요.
            </p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {upcoming.map((row, i) => (
                <li key={`w-${i}`} className="rounded-lg bg-teal/5 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-teal" />
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-brown">
                      {row[2]}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-4">
                    <span className="whitespace-nowrap text-xs text-gray-700">
                      {shortDate(normalizeDate(row[8]))} → {shortDate(normalizeDate(row[9]))}
                    </span>
                    {row[3] && (
                      <a href={telHref(row[3])} className="whitespace-nowrap text-xs text-teal-dark underline">
                        {row[3]}
                      </a>
                    )}
                    <StatusBadge status={bookingStatus(row)} />
                  </div>
                </li>
              ))}
              {upcomingAirbnb.map((r, i) => (
                <li key={`a-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-orange/5 px-3 py-2.5">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-orange" />
                  <span className="whitespace-nowrap text-sm font-medium text-brown">에어비앤비</span>
                  <span className="whitespace-nowrap text-xs text-gray-700">
                    {shortDate(normalizeDate(r.start))} → {shortDate(normalizeDate(r.end))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={CARD}>
        <h2 className={`${SECTION_H} mb-3`}>전체 방 현황 (다음 30일)</h2>
        <div className={`${CARD_GRID} grid-cols-3`}>
          {ROOM_KEYS.map((key) => {
            const name = ROOM_NAMES[key];
            const web = stayRows.filter(
              (r) => r[6] === name && r[9] && normalizeDate(r[9]) >= todayISO && normalizeDate(r[8]) <= in30
            ).length;
            const ab = (airbnbRanges[key] ?? []).filter(
              (r) => normalizeDate(r.end) >= todayISO && normalizeDate(r.start) <= in30
            ).length;
            return (
              <div key={key} className="min-w-0 rounded-lg bg-cream/60 px-3 py-3 text-center">
                <p className="mb-1.5 whitespace-nowrap text-xs text-gray-700">{name}</p>
                <p className="whitespace-nowrap text-xs">
                  <span className="font-medium text-teal-dark">웹 {web}</span>
                  <span className="mx-1 text-gray-500">/</span>
                  <span className="font-medium text-brown">에어 {ab}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
