import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "어드민 | 코이노니아",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 bg-cream/40">{children}</div>;
}
