// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN || "http://localhost:3000"),
  title: "صيانة الأثاث في إربد | حجز موعد مع معارض الأثاث - اتحاد الصيانة",
  description:
    "احجز صيانة الأثاث في إربد: اختر معرض الأثاث، خدمة الصيانة، والمكان المناسب لك، ثم شاهد المواعيد المتاحة وأكّد طلبك أونلاين.",
  keywords: [
    "صيانة الأثاث إربد",
    "تصليح أثاث إربد",
    "حجز صيانة أثاث",
    "معارض الأثاث إربد",
    "صيانة أثاث منزلية",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: process.env.APP_ENV === "production",
    follow: process.env.APP_ENV === "production",
  },
  openGraph: {
    type: "website",
    locale: "ar_JO",
    title: "اتحاد الصيانة - إربد | حجز صيانة الأثاث",
    description: "اختر معرض الأثاث وخدمة الصيانة والموعد المناسب في إربد.",
    url: "/",
    siteName: "اتحاد الصيانة - إربد",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
