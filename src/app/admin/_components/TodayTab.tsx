"use client";

import { ageDays, type Digest } from "@/lib/digest";
import Banner from "./Banner";
import StatusBadge from "./StatusBadge";
import SummaryCard from "./SummaryCard";
import {
  CARD_EMPTY,
  CARD_FLUSH,
  CARD_GRID,
  SECTION_COUNT,
  SECTION_H,
  bookingStatus,
  contentOf,
  shortDate,
  shortDateTime,
  telHref,
  whenOf,
  type Row,
} from "./shared";

const ROOM_KO: Record<string, string> = {
  nagnae: "나그네방",
  oksun: "옥순방",
  yeutae: "여태방",
};

/**
 * 오늘 탭의 읽기 전용 행.
 * 이름·내용·일시·연락처·배지를 한 줄에 두면 390px에서 문서 폭이 넘쳐 화면이 잘린다.
 * 그래서 항상 2줄로 나눈다 — 1줄은 이름 + 내용(넘치면 말줄임), 2줄은 나머지를 flex-wrap.
 */
function MiniRow({ row, trailing }: { row: Row; trailing?: string }) {
  return (
    <li className="border-b border-gray-100 px-4 py-3 last:border-0">
      <div className="flex items-baseline gap-3">
        <span className="whitespace-nowrap text-sm font-medium text-brown">{row[2] || "이름 없음"}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-gray-700">
          {contentOf(row)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="whitespace-nowrap text-xs text-gray-700">{trailing ?? whenOf(row)}</span>
        {row[3] && (
          <a href={telHref(row[3])} className="whitespace-nowrap text-xs text-teal-dark underline">
            {row[3]}
          </a>
        )}
        <StatusBadge status={bookingStatus(row)} />
      </div>
    </li>
  );
}

function Section({
  id,
  title,
  count,
  empty,
  children,
}: {
  id: string;
  title: string;
  count: number;
  empty: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-56 md:scroll-mt-48">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={`${id}-h`} className={SECTION_H}>
          {title}
        </h2>
        <span className={SECTION_COUNT}>{count}건</span>
      </div>
      {count === 0 ? (
        <p className={`${CARD_EMPTY} text-xs break-keep text-gray-700`}>
          {empty}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

export type AirbnbEvent = { room: string; start: string; end: string };

/** 오늘 탭 — 로그인 직후 오늘 할 일을 보고 이 화면에서 처리까지 끝낸다 */
export default function TodayTab({
  digest,
  conflicts,
  airbnbCheckIns,
  airbnbCheckOuts,
  onGoCalendar,
  onGoPending,
}: {
  digest: Digest;
  conflicts: { room: string; date: string }[];
  airbnbCheckIns: AirbnbEvent[];
  airbnbCheckOuts: AirbnbEvent[];
  onGoCalendar: () => void;
  /** 입금대기 카드·배너 → 신청 리스트 탭(입금대기 필터) */
  onGoPending: () => void;
}) {
  const pending = digest.pending;
  const oldest = pending.length > 0 ? ageDays(pending[0][0]) : 0;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      {pending.length > 0 ? (
        <Banner
          tone="warn"
          title={`입금대기 ${pending.length}건 · 가장 오래된 건 ${oldest}일 경과`}
          detail="신청 리스트에서 입금확인을 눌러주세요. 게스트에게 확정 알림톡이 나갑니다."
          action={{ label: "처리하러 가기", onClick: onGoPending }}
        />
      ) : (
        <Banner
          tone="ok"
          title="오늘 처리할 입금이 없어요"
          detail={(() => {
            const total = digest.checkIns.length + airbnbCheckIns.length;
            return total > 0
              ? `오늘 체크인 ${total}건만 챙기면 돼요.`
              : "오늘 들어오는 손님도 없어요. 여유 있는 하루예요.";
          })()}
        />
      )}

      {conflicts.length > 0 && (
        <Banner
          tone="error"
          title={`에어비앤비 이중예약 주의 · ${conflicts.length}건`}
          detail={conflicts
            .slice(0, 4)
            .map((c) => `${shortDate(c.date)} ${c.room}`)
            .join(" · ")}
          action={{ label: "캘린더 열기", onClick: onGoCalendar }}
        />
      )}

      <div id="today-top" className={`${CARD_GRID} grid-cols-2 md:grid-cols-4`}>
        <SummaryCard
          label="입금대기"
          value={`${pending.length}건`}
          tone="orange"
          onClick={onGoPending}
        />
        <SummaryCard
          label="오늘 체크인"
          value={`${digest.checkIns.length + airbnbCheckIns.length}건`}
          tone="teal"
          onClick={() => scrollTo("today-checkin")}
        />
        <SummaryCard
          label="오늘 체크아웃"
          value={`${digest.checkOuts.length + airbnbCheckOuts.length}건`}
          tone="teal"
          onClick={() => scrollTo("today-checkout")}
        />
        <SummaryCard
          label="오늘 살롱"
          value={`${digest.salonToday.length}건`}
          tone="brown"
          onClick={() => scrollTo("today-salon")}
        />
      </div>

      <Section id="today-checkin" title="오늘 체크인" count={digest.checkIns.length} empty="오늘 들어오는 손님이 없어요.">
        <ul className={CARD_FLUSH}>
          {digest.checkIns.map((row, i) => (
            <MiniRow key={`ci-${i}`} row={row} trailing={`${shortDate(row[8])} → ${shortDate(row[9])}`} />
          ))}
        </ul>
      </Section>

      <Section
        id="today-checkout"
        title="오늘 체크아웃"
        count={digest.checkOuts.length}
        empty="오늘 나가는 손님이 없어요."
      >
        <ul className={CARD_FLUSH}>
          {digest.checkOuts.map((row, i) => (
            <MiniRow key={`co-${i}`} row={row} trailing={`${shortDate(row[8])} → ${shortDate(row[9])}`} />
          ))}
        </ul>
      </Section>

      <Section id="today-salon" title="오늘 살롱" count={digest.salonToday.length} empty="오늘 진행하는 살롱이 없어요.">
        <ul className={CARD_FLUSH}>
          {digest.salonToday.map((row, i) => (
            <MiniRow key={`s-${i}`} row={row} />
          ))}
        </ul>
      </Section>

      {/* 에어비앤비 iCal 체크인/체크아웃 — 웹사이트 예약과 별개로 표시 */}
      {(airbnbCheckIns.length > 0 || airbnbCheckOuts.length > 0) && (
        <>
          <section aria-labelledby="today-airbnb-h" className="scroll-mt-56 md:scroll-mt-48">
            <div className="mb-2 flex items-baseline gap-2">
              <h2 id="today-airbnb-h" className={SECTION_H}>
                에어비앤비 iCal
              </h2>
              <span className="rounded bg-orange/10 px-2 py-0.5 text-xs text-brown">외부 예약</span>
            </div>
            <p className="mb-3 text-xs leading-5 break-keep text-gray-700">
              에어비앤비에서 직접 예약된 건이에요. 웹사이트 예약 시스템과 별개로 표시됩니다.
            </p>

            {airbnbCheckIns.length > 0 && (
              <div className="mb-4 space-y-1">
                <p className="px-1 text-xs font-medium text-gray-700">체크인 ({airbnbCheckIns.length}건)</p>
                <ul className={CARD_FLUSH}>
                  {airbnbCheckIns.map((ev, i) => (
                    <li key={`aci-${i}`} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                      <span className="text-sm font-medium text-brown">{ROOM_KO[ev.room] ?? ev.room}</span>
                      <span className="text-xs text-gray-700">{shortDate(ev.start)} → {shortDate(ev.end)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {airbnbCheckOuts.length > 0 && (
              <div className="space-y-1">
                <p className="px-1 text-xs font-medium text-gray-700">체크아웃 ({airbnbCheckOuts.length}건)</p>
                <ul className={CARD_FLUSH}>
                  {airbnbCheckOuts.map((ev, i) => (
                    <li key={`aco-${i}`} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                      <span className="text-sm font-medium text-brown">{ROOM_KO[ev.room] ?? ev.room}</span>
                      <span className="text-xs text-gray-700">{shortDate(ev.start)} → {shortDate(ev.end)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      <Section
        id="today-new"
        title="어제 신규 신청"
        count={digest.newYesterday.length}
        empty="어제 들어온 새 신청이 없어요."
      >
        <ul className={CARD_FLUSH}>
          {digest.newYesterday.map((row, i) => (
            <MiniRow key={`n-${i}`} row={row} trailing={shortDateTime(row[0])} />
          ))}
        </ul>
      </Section>

    </div>
  );
}
