// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 600,
        margin: "10vh auto",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div className="union-brand">
        <b>اتحاد الصيانة</b>
        <small>إربد</small>
      </div>
      <h1>تعذر تحميل الصفحة</h1>
      <p>
        تحقق من اتصالك ثم حاول مجددًا. إذا ظهر لك رقم طلب سابقًا، احتفظ به
        وتواصل مع المعرض قبل تكرار الحجز.
      </p>
      <button onClick={reset}>إعادة المحاولة</button>
    </main>
  );
}
