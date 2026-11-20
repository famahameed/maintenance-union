// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import EmployeePortal from "./employee-portal";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "موظف المعرض | اتحاد الصيانة",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export const dynamic = "force-dynamic";

export default function TeamPage() {
  return <EmployeePortal />;
}
