// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import type { Metadata } from "next";
import "../portal/portal.css";
export const metadata: Metadata = {
  title: "بوابات المعارض | اتحاد الصيانة - إربد",
  robots: { index: false, follow: false },
};
export default function Portals() {
  return (
    <main className="u-directory" dir="rtl">
      <a href="/" className="union-brand">
        <b>اتحاد الصيانة - اربد</b>
      </a>
      <h1>بوابات المعرض</h1>
      <p>ادخل إلى البوابة المخصصة لحسابك.</p>
      <div className="u-directory-grid">
        {[
          [
            "/showroom",
            "مدير المعرض",
            "الحجوزات والمواعيد والخدمات وموظفو معرضك.",
          ],
          ["/team", "موظف المعرض", "المهام المسندة إليك وتحديث حالة التنفيذ."],
        ].map(([href, title, desc]) => (
          <a key={href} href={href}>
            <h2>{title}</h2>
            <p>{desc}</p>
            <span>فتح البوابة ←</span>
          </a>
        ))}
      </div>
    </main>
  );
}
