import { isConfirmed, isPending } from "@/lib/digest";

export type BadgeTone = "pending" | "confirmed" | "cancelled" | "warn" | "neutral" | "salon" | "stay";

const TONE: Record<BadgeTone, { box: string; dot: string }> = {
  // 입금대기: 노랑 계열 (cream 바탕 + brown 글자)
  pending: { box: "bg-cream border-orange/40 text-brown", dot: "bg-orange" },
  // 확정: 초록 대신 브랜드 teal
  confirmed: { box: "bg-teal/10 border-teal/30 text-teal-dark", dot: "bg-teal" },
  cancelled: { box: "bg-gray-100 border-gray-300 text-gray-600", dot: "bg-gray-400" },
  warn: { box: "bg-orange/10 border-orange/40 text-brown", dot: "bg-orange-dark" },
  neutral: { box: "bg-white border-gray-300 text-gray-700", dot: "bg-gray-400" },
  salon: { box: "bg-orange/10 border-orange/30 text-brown", dot: "bg-orange-dark" },
  stay: { box: "bg-teal/10 border-teal/30 text-teal-dark", dot: "bg-teal" },
};

/** 색만으로 상태를 전달하지 않도록 항상 텍스트 라벨 + 색 점을 함께 쓴다. */
export function Badge({
  tone,
  children,
  dot = true,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
}) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${t.box}`}
    >
      {dot && <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />}
      <span className="whitespace-nowrap">{children}</span>
    </span>
  );
}

/** 예약 상태(N열) 배지 — 신청/빈값=입금대기, 입금확인·결제완료·확정=확정, 취소=회색 */
export default function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").trim();
  if (s === "취소") return <Badge tone="cancelled">취소</Badge>;
  if (s === "결제완료") return <Badge tone="confirmed">확정·카드</Badge>;
  if (isConfirmed(s)) return <Badge tone="confirmed">확정</Badge>;
  if (isPending(s) || !s) return <Badge tone="pending">입금대기</Badge>;
  return <Badge tone="neutral">{s}</Badge>;
}

/** 구분(살롱/스테이) 배지 */
export function TypeBadge({ type }: { type: string }) {
  return <Badge tone={type === "스테이" ? "stay" : "salon"}>{type || "살롱"}</Badge>;
}
