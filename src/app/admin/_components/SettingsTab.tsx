"use client";

import { useCallback, useEffect, useState } from "react";
import Banner from "./Banner";
import { BTN_DANGER, BTN_OUTLINE, CARD_FLUSH, SECTION_H } from "./shared";

export type NotifyEnv = {
  ok: boolean;
  missingRequired: string[];
  missingKakao: string[];
  kakaoMode: string;
  operatorPhoneMasked: string | null;
};

type ApiFetch = (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; data: unknown }>;

function CheckLine({ label, missing }: { label: string; missing: string[] }) {
  const good = missing.length === 0;
  return (
    <li className="flex items-baseline gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <span className="flex w-24 shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-gray-700">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${good ? "bg-teal" : "bg-orange-dark"}`}
        />
        {label}
      </span>
      <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] text-sm ${good ? "text-teal-dark" : "text-brown"}`}>
        {good ? "전부 설정됨" : `${missing.length}개 미설정 · ${missing.join(", ")}`}
      </span>
    </li>
  );
}

/** 설정 탭 — 알림 환경변수 점검(발송 없음) + 실제 테스트 문자 발송(확인 단계) */
export default function SettingsTab({ apiFetch }: { apiFetch: ApiFetch }) {
  const [env, setEnv] = useState<NotifyEnv | null>(null);
  const [envError, setEnvError] = useState("");
  const [checking, setChecking] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const applyEnv = useCallback((res: { ok: boolean; data: unknown }) => {
    if (res.ok) {
      setEnv(res.data as NotifyEnv);
      setEnvError("");
    } else {
      setEnvError("알림 설정을 불러오지 못했어요. [다시 점검]을 눌러주세요.");
    }
    setChecking(false);
  }, []);

  // 탭에 들어오면 발송 없이 점검만 한 번 (GET). await 뒤에서만 state를 바꾼다.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await apiFetch("/api/admin/notify-test");
      if (alive) applyEnv(res);
    })();
    return () => {
      alive = false;
    };
  }, [apiFetch, applyEnv]);

  const check = useCallback(async () => {
    setChecking(true);
    applyEnv(await apiFetch("/api/admin/notify-test"));
  }, [apiFetch, applyEnv]);

  const sendTest = async () => {
    setAsking(false);
    setSending(true);
    setResult(null);
    const res = await apiFetch("/api/admin/notify-test", { method: "POST" });
    const d = (res.data ?? {}) as Record<string, unknown>;
    const lines: string[] = [];
    if (typeof d.error === "string") lines.push(d.error);
    if (typeof d.kakaoMode === "string") lines.push(`발송 모드: ${d.kakaoMode}`);
    if (typeof d.sentTo === "string") lines.push(`수신번호: ${d.sentTo}`);
    setResult({
      ok: res.ok && d.ok === true,
      text: lines.join(" · ") || (res.ok ? "발송 요청이 처리됐어요." : "발송에 실패했어요."),
    });
    setSending(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <section aria-labelledby="settings-env-h" className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 id="settings-env-h" className={SECTION_H}>
            알림 설정 상태
          </h2>
          <button type="button" onClick={check} disabled={checking} className={BTN_OUTLINE}>
            {checking ? "확인 중…" : "다시 점검"}
          </button>
        </div>

        {envError && <Banner tone="error" title={envError} />}

        {env && (
          <>
            <ul className={`${CARD_FLUSH} px-4`}>
              <CheckLine label="필수 항목" missing={env.missingRequired} />
              <CheckLine label="알림톡 템플릿" missing={env.missingKakao} />
            </ul>
            <p className="text-xs leading-5 break-keep text-gray-700">
              현재 발송 모드: {env.kakaoMode}
              {env.missingKakao.length > 0 &&
                " — 이 상태에서는 게스트에게 알림톡이 나가지 않고 호스트에게만 문자가 갑니다."}
            </p>
          </>
        )}

        {!env && !envError && (
          <div className={`${CARD_FLUSH} h-28 animate-pulse`} aria-busy="true" />
        )}
      </section>

      <section aria-labelledby="settings-test-h" className="space-y-2">
        <h2 id="settings-test-h" className={SECTION_H}>
          테스트 문자 보내기
        </h2>
        <p className="text-xs leading-5 break-keep text-gray-700">
          호스트 번호 {env?.operatorPhoneMasked ?? "(미설정)"}로 <strong>실제 문자 1건</strong>이 발송됩니다. 건당
          비용이 들어요.
        </p>

        {asking ? (
          <div className="rounded-xl border border-orange/40 bg-orange/10 p-4 md:p-5">
            <p className="text-sm break-keep text-brown">
              지금 {env?.operatorPhoneMasked ?? "호스트 번호"}로 테스트 문자를 1건 보낼까요?
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setAsking(false)} className={BTN_OUTLINE}>
                그만두기
              </button>
              <button type="button" onClick={sendTest} className={BTN_DANGER}>
                보내기
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAsking(true)} disabled={sending} className={BTN_OUTLINE}>
            {sending ? "발송 중…" : "테스트 문자 보내기"}
          </button>
        )}

        {result && (
          <Banner tone={result.ok ? "ok" : "error"} title={result.ok ? "테스트 발송 완료" : "테스트 발송 실패"} detail={result.text} onDismiss={() => setResult(null)} />
        )}
      </section>
    </div>
  );
}
