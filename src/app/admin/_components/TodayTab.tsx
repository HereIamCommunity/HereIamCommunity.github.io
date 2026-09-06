"use client";

import { ageDays, type Digest } from "@/lib/digest";
import Banner from "./Banner";
import BookingCard from "./BookingCard";
import StatusBadge from "./StatusBadge";
import SummaryCard from "./SummaryCard";
import {
  amountText,
  bookingStatus,
  contentOf,
  shortDate,
  shortDateTime,
  telHref,
  whenOf,
  type AdminActions,
  type Row,
} from "./shared";

/** 오늘 탭의 읽기 전용 한 줄 — 라벨/값은 가로 배치, 값만 break-keep */
function MiniRow({ row, trailing }: { row: Row; trailing?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 px-4 py-3 last:border-0">
      <span className="whitespace-nowrap text-sm font-medium text-brown">{row[2] || "이름 없음"}</span>
      <span className="min-w-0 flex-1 break-keep text-sm text-gray-700">{contentOf(row)}</span>
      <span className="whitespace-nowrap text-xs text-gray-700">{trailing ?? whenOf(row)}</span>
      {row[3] && (
        <a href={telHref(row[3])} className="whitespace-nowrap text-xs text-teal-dark underline">
          {row[3]}
        </a>
      )}
      <StatusBadge status={bookingStatus(row)} />
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
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={`${id}-h`} className="whitespace-nowrap text-sm font-medium text-brown">
          {title}
        </h2>
        <span className="whitespace-nowrap text-xs text-gray-700">{count}건</span>
      </div>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-xs break-keep text-gray-700">
          {empty}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

/** 오늘 탭 — 로그인 직후 오늘 할 일을 보고 이 화면에서 처리까지 끝낸다 */
export default function TodayTab({
  digest,
  actions,
  conflicts,
  onGoList,
  onGoCalendar,
}: {
  digest: Digest;
  actions: AdminActions;
  conflicts: { room: string; date: string }[];
  onGoList: () => void;
  onGoCalendar: () => void;
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
          detail="입금이 확인되면 [입금확인]을 눌러주세요. 게스트에게 확정 알림톡이 나갑니다."
          action={{ label: "처리하러 가기", onClick: () => scrollTo("today-pending") }}
        />
      ) : (
        <Banner
          tone="ok"
          title="오늘 처리할 입금이 없어요"
          detail={
            digest.checkIns.length > 0
              ? `오늘 체크인 ${digest.checkIns.length}건만 챙기면 돼요.`
              : "오늘 들어오는 손님도 없어요. 여유 있는 하루예요."
          }
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

      <div id="today-top" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="입금대기"
          value={`${pending.length}건`}
          tone="orange"
          onClick={() => scrollTo("today-pending")}
        />
        <SummaryCard
          label="오늘 체크인"
          value={`${digest.checkIns.length}건`}
          tone="teal"
          onClick={() => scrollTo("today-checkin")}
        />
        <SummaryCard
          label="오늘 체크아웃"
          value={`${digest.checkOuts.length}건`}
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

      <Section
        id="today-pending"
        title="입금대기 (오래된 순)"
        count={pending.length}
        empty="입금대기 건이 없어요."
      >
        <ul className="grid gap-2 md:grid-cols-2">
          {pending.map((row, i) => (
            <BookingCard key={`p-${row[0]}-${row[3]}-${i}`} row={row} actions={actions} />
          ))}
        </ul>
      </Section>

      <Section id="today-checkin" title="오늘 체크인" count={digest.checkIns.length} empty="오늘 들어오는 손님이 없어요.">
        <ul className="rounded-xl border border-gray-200 bg-white">
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
        <ul className="rounded-xl border border-gray-200 bg-white">
          {digest.checkOuts.map((row, i) => (
            <MiniRow key={`co-${i}`} row={row} trailing={`${shortDate(row[8])} → ${shortDate(row[9])}`} />
          ))}
        </ul>
      </Section>

      <Section id="today-salon" title="오늘 살롱" count={digest.salonToday.length} empty="오늘 진행하는 살롱이 없어요.">
        <ul className="rounded-xl border border-gray-200 bg-white">
          {digest.salonToday.map((row, i) => (
            <MiniRow key={`s-${i}`} row={row} />
          ))}
        </ul>
      </Section>

      <Section
        id="today-new"
        title="어제 신규 신청"
        count={digest.newYesterday.length}
        empty="어제 들어온 새 신청이 없어요."
      >
        <ul className="rounded-xl border border-gray-200 bg-white">
          {digest.newYesterday.map((row, i) => (
            <MiniRow key={`n-${i}`} row={row} trailing={shortDateTime(row[0])} />
          ))}
        </ul>
      </Section>

      <section aria-labelledby="today-month-h" className="space-y-2">
        <h2 id="today-month-h" className="whitespace-nowrap text-sm font-medium text-brown">
          이번 달 숫자
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="확정 건수" value={`${digest.month.confirmedCount}건`} tone="teal" />
          <SummaryCard label="확정 금액" value={amountText(String(digest.month.confirmedAmount))} tone="orange" />
        </div>
        <p className="text-xs leading-5 break-keep text-gray-700">
          입금확인·결제완료만 셉니다 (취소 제외). 전체 내역은{" "}
          <button type="button" onClick={onGoList} className="underline">
            목록 탭
          </button>
          에서 볼 수 있어요.
        </p>
      </section>
    </div>
  );
}
