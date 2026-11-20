// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
"use client";
import { timeLabel } from "../../lib/union/types";
export type Operations = {
  summary: {
    unassigned: number;
    awaiting_approval: number;
    overdue: number;
    needs_handover: number;
  };
  upcoming: {
    id: string;
    reference: string;
    booking_date: string;
    start_minute: number;
    showroom_name: string;
    request_name_ar: string;
  }[];
  events: {
    id: number;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
    actor_name: string | null;
  }[];
};
export function DailyActions({
  data,
  onQueue,
}: {
  data: Operations;
  onQueue: (queue: string) => void;
}) {
  return (
    <section className="u-panel">
      <h2>يحتاج متابعتك</h2>
      <div className="u-action-queues">
        {[
          ["unassigned", "بانتظار إسناد", data.summary.unassigned],
          ["approval", "بانتظار اعتماد", data.summary.awaiting_approval],
          ["overdue", "طلبات متأخرة", data.summary.overdue],
          ["handover", "تسليم لموظف بديل", data.summary.needs_handover],
        ].map(([q, label, count]) => (
          <button key={q} onClick={() => onQueue(String(q))}>
            <strong>{Number(count || 0)}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <h3>أقرب المواعيد</h3>
      {data.upcoming.length ? (
        data.upcoming.map((b) => (
          <article className="u-service" key={b.id}>
            <div>
              <strong>
                {b.showroom_name} · {b.request_name_ar}
              </strong>
              <small dir="ltr">{b.reference}</small>
            </div>
            <bdi>
              {b.booking_date} · {timeLabel(b.start_minute)}
            </bdi>
          </article>
        ))
      ) : (
        <p className="u-muted">لا توجد مواعيد قادمة.</p>
      )}
    </section>
  );
}
const labels: Record<string, string> = {
  database_insert: "تسجيل إضافة في قاعدة البيانات",
  database_update: "تسجيل تغيير في قاعدة البيانات",
  booking_created: "إنشاء حجز",
  approve_booking: "اعتماد إنجاز طلب",
  cancel_booking: "إلغاء حجز",
  employee_start: "بدء تنفيذ مهمة",
  employee_complete: "إنهاء مهمة بانتظار الاعتماد",
  add_request_type: "إضافة خدمة",
  toggle_request_type: "تغيير نشر خدمة",
  create_employee: "إضافة موظف",
  toggle_employee: "تغيير حالة موظف",
  admin_created_from_terminal: "تهيئة حساب الإدارة",
  admin_password_changed_from_terminal: "استعادة كلمة مرور الإدارة",
  login: "دخول ناجح",
  login_failed: "محاولة دخول غير ناجحة",
  login_throttled: "تقييد محاولات دخول",
  mfa_failed: "رمز تحقق غير صحيح",
  mfa_setup: "بدء إعداد التحقق بخطوتين",
  mfa_enable: "تفعيل التحقق بخطوتين",
  mfa_disable: "تعطيل التحقق بخطوتين",
  reset_password: "إعادة تعيين كلمة مرور",
  change_password: "تغيير كلمة مرور",
  delete_staff: "حذف حساب",
  toggle_staff: "تغيير حالة حساب",
  revoke_sessions: "إنهاء جلسات حساب",
  logout_all_self: "خروج من جميع الأجهزة",
  create_staff: "إضافة حساب",
  create_showroom: "إضافة معرض",
  toggle_showroom: "تغيير حالة معرض",
  update_showroom: "تعديل معرض",
  save_settings: "تعديل المواعيد والسعة",
  assign_booking: "إسناد مهمة",
  handover_booking: "تسليم مهمة",
  staff_security_changed: "تغيير أمان حساب (سجل قاعدة البيانات)",
  booking_status_changed: "تغير حالة طلب (سجل قاعدة البيانات)",
};
export function SecurityEvents({ events }: { events: Operations["events"] }) {
  return (
    <section className="u-panel">
      <h2>سجل العمليات والأمان</h2>
      <p className="u-muted">
        آخر 100 حدث على مستوى النظام. محاولات الدخول لا تعرض أرقام الهواتف أو
        كلمات المرور. التوقيت بتوقيت الأردن.
      </p>
      <div className="u-event-list">
        {events.map((e) => (
          <article className="u-service" key={e.id}>
            <div>
              <strong>{labels[e.action] || e.action}</strong>
              <small>
                {e.actor_name || "النظام / زائر"} ·{" "}
                {(
                  {
                    staff: "حساب",
                    bookings: "طلب",
                    booking: "طلب",
                    security: "أمان",
                    union: "إدارة النظام",
                  } as Record<string, string>
                )[e.entity_type] || "عملية"}
              </small>
            </div>
            <time dateTime={e.created_at}>
              {new Date(e.created_at.replace(" ", "T") + "Z").toLocaleString(
                "ar-JO",
                { timeZone: "Asia/Amman" },
              )}
            </time>
          </article>
        ))}
      </div>
    </section>
  );
}
