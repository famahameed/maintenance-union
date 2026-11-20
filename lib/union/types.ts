// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
export type Showroom = {
  id: string;
  name: string;
  name_en: string;
  logo_url: string;
  manager_phones?: string;
  phone: string;
  city: string;
  address: string;
  active: number;
  work_start_minute: number;
  work_end_minute: number;
  booking_duration_minute: number;
  teams_count: number;
  daily_booking_limit: number;
  employee_daily_limit: number;
  home_service_enabled: number;
  shop_service_enabled: number;
  work_days: string;
  assignment_mode: string;
  updated_at: string;
};
export type Staff = {
  read_only?: number;
  id: string;
  name: string;
  phone: string;
  role: "admin" | "manager" | "employee";
  active: number;
  showroom_id: string;
  showroom_name?: string;
  session_count?: number;
};
export type Service = {
  id: number;
  name_ar: string;
  name_en: string;
  showroom_id: string;
  published: number;
};
export type Booking = {
  id: string;
  reference: string;
  showroom_id: string;
  showroom_name: string;
  customer_name: string;
  phone: string;
  whatsapp: number;
  request_name_ar: string;
  request_name_en: string;
  booking_date: string;
  start_minute: number;
  duration_minute: number;
  service_mode: string;
  city: string;
  district: string;
  address_line: string;
  latitude: string | null;
  longitude: string | null;
  google_maps_url: string;
  status: string;
  assigned_staff_id: string | null;
  employee_name: string | null;
  notes: string;
  completion_note: string;
};
export const STATUS_LABELS: Record<string, string> = {
  confirmed: "بانتظار الإسناد",
  assigned: "مسند للموظف",
  in_progress: "قيد التنفيذ",
  pending_admin_approval: "بانتظار اعتماد الإنجاز",
  completed: "مكتمل",
  cancelled: "ملغي",
  rejected: "مرفوض",
};
export const ROLE_LABELS = {
  admin: "الإدارة العامة",
  manager: "صاحب المعرض",
  employee: "موظف صيانة",
};
export function timeLabel(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
export function todayInJordan() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
