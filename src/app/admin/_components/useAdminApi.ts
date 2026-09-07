"use client";

import { useCallback } from "react";

export type ApiResult = { ok: boolean; status: number; data: unknown };

/**
 * 어드민 API 공통 fetch — 비밀번호 헤더를 붙이고 401이면 로그인 화면으로 돌려보낸다.
 * 네트워크 오류도 예외 대신 { ok:false } 로 돌려줘서 호출부가 분기 하나만 쓰면 된다.
 */
export function useAdminApi(password: string, onUnauthorized: () => void) {
  return useCallback(
    async (path: string, init?: RequestInit): Promise<ApiResult> => {
      try {
        const headers: Record<string, string> = {
          "x-admin-password": password,
          ...((init?.headers as Record<string, string>) ?? {}),
        };
        if (init?.body) headers["Content-Type"] = "application/json";

        const res = await fetch(path, { ...init, headers });
        if (res.status === 401) {
          onUnauthorized();
          return { ok: false, status: 401, data: { error: "비밀번호가 만료됐어요. 다시 로그인해주세요." } };
        }
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: false, status: 0, data: { error: "서버에 연결하지 못했어요." } };
      }
    },
    [password, onUnauthorized]
  );
}
