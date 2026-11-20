// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import Portal from "../portal/portal";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "مدير المعرض | اتحاد الصيانة",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default function ShowroomPage() {
  return <Portal role="manager" />;
}
