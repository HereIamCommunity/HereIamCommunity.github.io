import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트 (service role — RLS를 우회한다).
 * 브라우저 번들에 들어가면 키가 새므로 `server-only`로 막는다.
 *
 * 환경변수가 없으면 null — 호출부는 시트 시절처럼 "저장 건너뜀 / 빈 결과"로 동작한다(로컬 개발용).
 */
let cached: SupabaseClient | null | undefined;

export function getDb(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return cached;
}
