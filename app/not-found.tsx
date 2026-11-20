// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
export default function NotFound() {
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
      <h1>الصفحة غير موجودة</h1>
      <p>قد يكون الرابط غير صحيح أو تغيّر عنوان الصفحة.</p>
      <a href="/">العودة إلى اتحاد الصيانة</a>
    </main>
  );
}
