"use client";

import { useId, useState } from "react";
import { BTN_OUTLINE, CARD, CARD_STACK, telHref } from "./shared";

export type EntryField = { label: string; value: string; tel?: boolean };

/**
 * 리트릿·무료개방처럼 자유 서술 열이 많은 목록에 쓰는 카드.
 * 표로 만들면 긴 문장이 셀을 밀어내므로, 짧은 값만 앞에 두고 나머지는 [더보기]에 넣는다.
 */
export default function EntryCard({
  title,
  badge,
  fields,
  details,
  actions,
  message,
}: {
  title: string;
  badge?: React.ReactNode;
  fields: EntryField[];
  details: EntryField[];
  actions?: React.ReactNode;
  message?: { ok: boolean; text: string };
}) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <li className={`${CARD} ${CARD_STACK}`}>
      <div className="mb-3 flex items-start gap-2">
        <p className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-base font-medium text-brown">
          {title}
        </p>
        {badge && <span className="shrink-0">{badge}</span>}
      </div>

      <div className="space-y-1.5">
        {fields.map((f) => (
          <div key={f.label} className="flex items-baseline gap-3">
            <span className="w-16 shrink-0 whitespace-nowrap text-xs text-gray-600">{f.label}</span>
            <span className="min-w-0 flex-1 break-keep text-sm text-brown">
              {f.tel && f.value ? (
                <a href={telHref(f.value)} className="whitespace-nowrap text-teal-dark underline">
                  {f.value}
                </a>
              ) : (
                f.value || "—"
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {actions}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailId}
          className={`${BTN_OUTLINE} shrink-0`}
        >
          {open ? "접기" : "더보기"}
        </button>
      </div>

      {message && (
        <p
          aria-live="polite"
          className={`mt-2 min-w-0 break-keep text-xs leading-4 ${
            message.ok ? "text-teal-dark" : "text-brown"
          }`}
        >
          {message.text}
        </p>
      )}

      {open && (
        <dl id={detailId} className="mt-3 space-y-2 border-t border-gray-200 pt-3">
          {details.map((d) => (
            <div key={d.label} className="flex items-baseline gap-3">
              <dt className="w-16 shrink-0 whitespace-nowrap text-xs text-gray-600">{d.label}</dt>
              <dd className="min-w-0 flex-1 break-keep text-sm text-brown">{d.value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
