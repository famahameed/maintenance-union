// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import LoadingIndicator from "./loading-indicator";
export default function Loading() {
  return (
    <main
      className="u-loading"
      dir="rtl"
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div className="u-loading-panel">
        <div className="union-brand">
          <b>اتحاد الصيانة</b>
          <small>إربد</small>
        </div>
        <LoadingIndicator text="نجهّز الصفحة…" />
      </div>
    </main>
  );
}
