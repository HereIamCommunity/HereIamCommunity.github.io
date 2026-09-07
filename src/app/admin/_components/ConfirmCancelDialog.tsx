"use client";

import { useEffect, useRef, useState } from "react";
import { BTN_DANGER, BTN_OUTLINE, FIELD } from "./shared";

export const CANCEL_REASONS = ["게스트 요청", "입금 없음", "중복 신청", "기타"] as const;

/**
 * 취소 확인 다이얼로그.
 * 파괴적 액션이라 2단계 + 사유 선택 + 되돌리기 안내를 함께 보여준다.
 */
export default function ConfirmCancelDialog({
  lines,
  notice,
  askReason,
  onClose,
  onConfirm,
}: {
  lines: string[];
  notice: string;
  askReason: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<string>("");
  const closeRef = useRef<HTMLButtonElement>(null);

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
        aria-labelledby="cancel-dialog-title"
        className="relative w-full max-w-md rounded-t-xl border border-gray-200 bg-white p-4 shadow-lg sm:rounded-xl md:p-5"
      >
        <h2 id="cancel-dialog-title" className="text-base font-medium text-brown">
          예약을 취소할까요?
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
            <label htmlFor="cancel-reason" className="mb-1.5 block text-xs font-medium text-gray-700">
              취소 사유 (선택 · 요청사항 열에 기록됩니다)
            </label>
            <select
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={FIELD}
            >
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
          <button type="button" onClick={() => onConfirm(reason)} className={`${BTN_DANGER} flex-1`}>
            취소 처리
          </button>
        </div>
      </div>
    </div>
  );
}
