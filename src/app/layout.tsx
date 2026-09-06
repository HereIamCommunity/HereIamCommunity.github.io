import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "코이노니아 | 안동의 살롱과 스테이",
  description:
    "일, 놀이, 쉼의 조화를 통해 일상의 즐거움을 되찾는 공간. 경북 안동 코이노니아의 살롱 프로그램과 숙박 예약.",
  openGraph: {
    title: "코이노니아 | 안동의 살롱과 스테이",
    description: "일, 놀이, 쉼의 조화를 통해 일상의 즐거움을 되찾는 공간.",
    images: ["/images/hero/exterior-1.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
