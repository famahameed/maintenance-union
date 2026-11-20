// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
"use client";
import { useState } from "react";
import {
  Booking,
  Staff,
  STATUS_LABELS,
  timeLabel,
} from "../../lib/union/types";
import { Submit } from "./forms";
export default function BookingCard({
  booking: b,
  readOnly = false,
  staff,
  employee,
  busy,
  onSubmit,
}: {
  booking: Booking;
  readOnly?: boolean;
  staff: Staff[];
  employee: boolean;
  busy: boolean;
  onSubmit: Submit;
}) {
  const [note, setNote] = useState("");
  const rawMap =
    b.latitude && b.longitude
      ? `https://www.google.com/maps?q=${b.latitude},${b.longitude}`
      : b.google_maps_url;
  const map =
    /^https:\/\/(?:maps\.app\.goo\.gl|maps\.google\.com|www\.google\.com|goo\.gl)(?:\/|$)/i.test(
      rawMap || "",
    )
      ? rawMap
      : "";
  return (
    <article className="u-booking">
      <header>
        <div>
          <span className="u-showroom-tag">{b.showroom_name}</span>
          <h3>{b.customer_name}</h3>
          <p>
            {b.request_name_ar} ·{" "}
            {b.service_mode === "home" ? "صيانة منزلية" : "داخل المعرض"}
          </p>
        </div>
        <span className="u-status" data-status={b.status}>
          {STATUS_LABELS[b.status] || b.status}
        </span>
      </header>
      <div className="u-booking-time">
        <b>{b.booking_date}</b>
        <strong dir="ltr">
          {timeLabel(b.start_minute)} –{" "}
          {timeLabel(b.start_minute + b.duration_minute)}
        </strong>
        <span dir="ltr">{b.reference}</span>
      </div>
      <dl className="u-details">
        <div>
          <dt>العنوان</dt>
          <dd>
            {b.city} — {b.district} — {b.address_line || "الموقع على الخريطة"}
          </dd>
        </div>
        <div>
          <dt>الموظف</dt>
          <dd>{b.employee_name || "لم يتم الإسناد بعد"}</dd>
        </div>
        {b.notes && (
          <div>
            <dt>ملاحظات الزبون</dt>
            <dd>{b.notes}</dd>
          </div>
        )}
        {b.completion_note && (
          <div>
            <dt>ملاحظات التنفيذ</dt>
            <dd>{b.completion_note}</dd>
          </div>
        )}
      </dl>
      <div className="u-row u-contact">
        <a href={`tel:${b.phone}`} dir="ltr">
          {b.phone}
        </a>
        {!!b.whatsapp && (
          <a
            href={`https://wa.me/962${b.phone.slice(1)}`}
            target="_blank"
            rel="noreferrer"
          >
            واتساب
          </a>
        )}
        {map && (
          <a href={map} target="_blank" rel="noreferrer">
            فتح الموقع
          </a>
        )}
      </div>
      <div className="u-booking-actions" hidden={readOnly}>
        {employee ? (
          <>
            {b.status === "assigned" && (
              <button
                className="u-primary"
                disabled={busy}
                onClick={() =>
                  onSubmit({ action: "employee_start", bookingId: b.id })
                }
              >
                بدء الصيانة
              </button>
            )}
            {b.status === "in_progress" && (
              <form
                className="u-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await onSubmit({
                    action: "employee_complete",
                    bookingId: b.id,
                    note,
                  });
                }}
              >
                <label>
                  ملاحظات التنفيذ
                  <textarea
                    required
                    minLength={5}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    placeholder="ما الذي تم إصلاحه؟"
                  />
                </label>
                <button className="u-primary" disabled={busy}>
                  إنهاء الصيانة وإرسالها للاعتماد
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            {["confirmed", "assigned", "in_progress"].includes(b.status) && (
              <label>
                إسناد / تغيير الموظف
                <select
                  aria-label={`موظف الطلب ${b.reference}`}
                  value={b.assigned_staff_id || ""}
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.value) {
                      const note =
                        b.status === "in_progress"
                          ? window.prompt(
                              "سبب تسليم المهمة لموظف آخر (تبقى قيد التنفيذ):",
                            )
                          : "";
                      if (b.status === "in_progress" && !note) return;
                      onSubmit({
                        action:
                          b.status === "in_progress"
                            ? "handover_booking"
                            : "assign_booking",
                        bookingId: b.id,
                        employeeId: e.target.value,
                        note,
                      });
                    }
                  }}
                >
                  <option value="">اختر موظفًا</option>
                  {staff
                    .filter(
                      (s) =>
                        s.role === "employee" &&
                        s.showroom_id === b.showroom_id &&
                        s.active,
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {b.status === "pending_admin_approval" && (
              <button
                className="u-primary"
                disabled={busy}
                onClick={() =>
                  onSubmit({ action: "approve_booking", bookingId: b.id })
                }
              >
                اعتماد الإنجاز
              </button>
            )}
            {!["completed", "cancelled", "rejected"].includes(b.status) && (
              <button
                className="u-danger"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "هل تريد إلغاء هذا الحجز وإتاحة موعده من جديد؟",
                    )
                  )
                    onSubmit({ action: "cancel_booking", bookingId: b.id });
                }}
              >
                إلغاء الحجز
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
