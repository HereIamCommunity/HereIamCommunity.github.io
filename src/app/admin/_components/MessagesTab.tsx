"use client";

import {
  TEXT_SALON_RECEIVED,
  TEXT_SALON_CONFIRMED,
  TEXT_STAY_RECEIVED,
  TEXT_STAY_CONFIRMED,
} from "@/lib/kakao-texts";
import { CARD_FLUSH, SECTION_H } from "./shared";

type MessageCardProps = {
  title: string;
  subtitle: string;
  text: string;
};

function MessageCard({ title, subtitle, text }: MessageCardProps) {
  return (
    <div className={CARD_FLUSH}>
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-medium text-brown">{title}</p>
        <p className="mt-0.5 text-xs text-gray-700">{subtitle}</p>
      </div>
      <pre className="whitespace-pre-wrap break-keep px-4 py-3 font-sans text-sm leading-relaxed text-gray-900">
        {text}
      </pre>
    </div>
  );
}

function SectionBlock({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3">
      <h2 id={`${id}-h`} className={SECTION_H}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 메시지 탭 — 입금대기·확정 상태에서 게스트에게 나가는 알림톡 템플릿 미리보기 */
export default function MessagesTab() {
  return (
    <div className="max-w-2xl space-y-8">
      <SectionBlock id="msg-received" title="신청 접수 시 (입금 대기)">
        <MessageCard
          title="살롱 신청 접수"
          subtitle="살롱 신청 → 상태: 신청 · 입금 대기"
          text={TEXT_SALON_RECEIVED}
        />
        <MessageCard
          title="스테이 예약 접수"
          subtitle="스테이 예약 신청 → 상태: 신청 · 입금 대기"
          text={TEXT_STAY_RECEIVED}
        />
      </SectionBlock>

      <SectionBlock id="msg-confirmed" title="입금 확인 후 (확정)">
        <MessageCard
          title="살롱 참가 확정"
          subtitle="[입금확인] 버튼 클릭 → 상태: 확정"
          text={TEXT_SALON_CONFIRMED}
        />
        <MessageCard
          title="스테이 예약 확정"
          subtitle="[입금확인] 버튼 클릭 → 상태: 확정"
          text={TEXT_STAY_CONFIRMED}
        />
      </SectionBlock>
    </div>
  );
}
