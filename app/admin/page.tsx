// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import Portal from "../portal/portal";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "الإدارة العامة | اتحاد الصيانة",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default function AdminPage() {
  return <Portal role="admin" />;
}
