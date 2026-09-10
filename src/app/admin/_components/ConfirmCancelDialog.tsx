"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BTN_DANGER, BTN_OUTLINE, BTN_PRIMARY, FIELD } from "./shared";

export const CANCEL_REASONS = ["게스트 요청", "입금 없음", "중복 신청", "기타"] as const;

/**
 * 확인 다이얼로그 (되돌릴 수 없거나 여러 건을 한 번에 바꾸는 액션의 2단계).
 * 기본값은 행 하나를 취소할 때의 문구라, 예약 취소는 프롭 없이 그대로 쓰면 된다.
 * 일괄 처리(7장)는 제목·요약 줄·확인 버튼 텍스트만 갈아끼워 같은 껍데기를 재사용한다.
 */
export default function ConfirmCancelDialog({
  title = "예약을 취소할까요?",
  lines,
  notice,
  askReason = false,
  confirmLabel = "취소 처리",
  tone = "danger",
  onClose,
  onConfirm,
}: {
  /** 다이얼로그 제목 — 무엇이 일어나는지 한 줄로 */
  title?: string;
  /** 대상 요약 (한 줄에 하나) */
  lines: string[];
  /** 알림·되돌리기 등 실행 뒤 벌어지는 일 */
  notice: string;
  askReason?: boolean;
  confirmLabel?: string;
  /** danger = 파괴적(주황) · primary = 되돌리기처럼 복구에 가까운 액션 */
  tone?: "danger" | "primary";
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<string>("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const reasonId = useId();

  // 열릴 때마다 새로 mount 되므로(부모가 조건부 렌더) 사유는 항상 비어 있다.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Escape는 window가 아니라 이 트리 안에서 처리하고 전파를 끊는다 —
  // drawer 안에서 열렸을 때 drawer까지 같이 닫히면 안 된다.
  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-brown/40 p-0 sm:items-center sm:p-6"
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-t-xl border border-gray-200 bg-white p-4 shadow-lg sm:rounded-xl md:p-5"
      >
        <h2 id={titleId} className="text-base font-medium text-brown">
          {title}
        </h2>

        <dl className="mt-3 space-y-1.5 rounded-xl bg-cream/70 px-4 py-3">
          {lines.map((line) => (
            <dd key={line} className="min-w-0 text-sm break-keep text-brown">
              {line}
            </dd>
          ))}
        </dl>

        {askReason && (
          <div className="mt-4">
            <label htmlFor={reasonId} className="mb-1.5 block text-xs font-medium text-gray-700">
              취소 사유 (선택 · 요청사항 열에 기록됩니다)
            </label>
            <select id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD}>
              <option value="">선택 안 함</option>
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="mt-4 text-xs leading-5 break-keep text-gray-700">{notice}</p>

        <div className="mt-5 flex gap-2">
          <button ref={closeRef} type="button" onClick={onClose} className={`${BTN_OUTLINE} flex-1`}>
            그만두기
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            className={`${tone === "danger" ? BTN_DANGER : BTN_PRIMARY} flex-1`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
