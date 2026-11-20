// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
export default function LoadingIndicator({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`union-loading ${compact ? "union-loading-compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="union-spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
