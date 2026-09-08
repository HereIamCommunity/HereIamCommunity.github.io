"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ── 처리 결과 토스트 (6.2) ──────────────────────────────
   입금확인·취소·재발송·되돌리기 결과를 행 안 작은 글씨가 아니라 화면 우상단에 띄운다.
   운영자가 "눌렀는데 아무것도 안 뜬다"고 한 게 이 화면의 출발점이라, 실패도 성공만큼
   크게 말한다. 실패 토스트에는 [다시 시도]가 붙고, 해당 행은 2초 동안 테두리로 강조된다. */

export type ToastKind = "ok" | "error";
export type ToastInput = { kind: ToastKind; text: string; onRetry?: () => void };
export type ToastItem = ToastInput & { id: number; expiresAt: number };

/** 자동 닫힘 5초 · 최대 3개 · 만료 검사 주기 */
const LIFETIME_MS = 5000;
const MAX_STACK = 3;
const TICK_MS = 250;

export type ToastApi = {
  toasts: ToastItem[];
  push: (t: ToastInput) => void;
  dismiss: (id: number) => void;
  /** 호버·포커스 동안 자동 닫힘을 멈춘다 (읽는 도중에 사라지지 않도록) */
  pause: () => void;
  resume: () => void;
};

export function useToasts(): ToastApi {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const pausedAt = useRef<number | null>(null);

  const push = useCallback((t: ToastInput) => {
    setToasts((prev) =>
      [...prev, { ...t, id: nextId.current++, expiresAt: Date.now() + LIFETIME_MS }].slice(-MAX_STACK)
    );
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pause = useCallback(() => {
    if (pausedAt.current === null) pausedAt.current = Date.now();
  }, []);

  // 멈춰 있던 시간만큼 만료 시각을 뒤로 민다 — 타이머를 행마다 두지 않아도 된다.
  const resume = useCallback(() => {
    const at = pausedAt.current;
    if (at === null) return;
    pausedAt.current = null;
    const delta = Date.now() - at;
    setToasts((prev) => prev.map((t) => ({ ...t, expiresAt: t.expiresAt + delta })));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      if (pausedAt.current !== null) return;
      const now = Date.now();
      // 지울 게 없으면 같은 배열을 그대로 돌려줘 렌더를 만들지 않는다.
      setToasts((prev) => (prev.some((t) => t.expiresAt <= now) ? prev.filter((t) => t.expiresAt > now) : prev));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [toasts.length]);

  return { toasts, push, dismiss, pause, resume };
}

/* 성공은 teal 바탕 + 흰 글자(6.2:1), 실패는 orange 바탕 + brown 글자(4.9:1).
   teal 위의 brown은 2.2:1이라 본문 기준을 못 넘겨 흰 글자로 갔다.
   버튼은 두 경우 다 흰 바탕에 brown — 전역 포커스 링(orange-dark)이 주황 바탕 위에서는
   1.3:1이라 보이지 않기 때문이다. 흰 바탕이면 3.6:1로 링이 살아난다. */
const SURFACE: Record<ToastKind, string> = {
  ok: "border-teal-dark bg-teal text-white",
  error: "border-orange-dark bg-orange text-brown",
};
const LEAD: Record<ToastKind, string> = { ok: "처리 완료", error: "처리 실패" };
const TOAST_BTN =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-brown/30 bg-white px-3 text-xs font-medium text-brown transition-colors hover:bg-cream";

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  // 마운트 직후 한 프레임 뒤에 켜서 opacity/transform만 움직인다 (레이아웃 변화 없음).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div
      className={`pointer-events-auto w-full rounded-xl border p-3 shadow-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${SURFACE[toast.kind]} ${
        shown ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
      }`}
    >
      <p className="text-xs font-semibold tracking-wide whitespace-nowrap">{LEAD[toast.kind]}</p>
      <p className="mt-1 text-sm leading-5 break-keep">{toast.text}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {toast.onRetry && (
          <button
            type="button"
            onClick={() => {
              onDismiss(toast.id);
              toast.onRetry?.();
            }}
            className={TOAST_BTN}
          >
            다시 시도
          </button>
        )}
        <button type="button" onClick={() => onDismiss(toast.id)} className={TOAST_BTN}>
          닫기
        </button>
      </div>
    </div>
  );
}

/**
 * 토스트 더미. 컨테이너는 항상 렌더되어 있어야 라이브 리전이 추가를 읽어준다.
 * 화면을 덮지 않도록 컨테이너는 pointer-events-none, 토스트만 auto.
 */
export default function ToastStack({ toasts, dismiss, pause, resume }: ToastApi) {
  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className="pointer-events-none fixed top-4 right-4 left-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-[22rem]"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
