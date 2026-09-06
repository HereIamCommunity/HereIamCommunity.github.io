"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

/**
 * 공개 사이트의 Nav/Footer를 감싼다.
 * `/admin` 이하에서는 어드민 전용 화면만 렌더한다 —
 * 공개 Nav는 fixed top-0 이라 어드민이 pt-16으로 피해가야 했고, Footer도 필요 없다.
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname?.startsWith("/admin/");

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
