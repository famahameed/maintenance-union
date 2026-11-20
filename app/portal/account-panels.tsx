// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
"use client";
import { useEffect, useRef, useState } from "react";
import type { Showroom, Staff } from "../../lib/union/types";
import { ROLE_LABELS } from "../../lib/union/types";
import { MANAGER_PASSWORD_HINT } from "../../lib/union/password";
import { StaffForm, type Submit } from "./forms";

function NewPasswordFields() {
  return (
    <>
      <label>
        كلمة المرور الجديدة
        <input
          name="password"
          type="password"
          dir="ltr"
          required
          minLength={16}
          maxLength={16}
          autoComplete="new-password"
        />
        <small>{MANAGER_PASSWORD_HINT}</small>
      </label>
      <label>
        تأكيد كلمة المرور الجديدة
        <input
          name="confirmPassword"
          type="password"
          dir="ltr"
          required
          minLength={16}
          maxLength={16}
          autoComplete="new-password"
        />
      </label>
    </>
  );
}

export function MyAccount({
  user,
  sessionCount,
  busy,
  onSubmit,
}: {
  user: Staff;
  sessionCount: number;
  busy: boolean;
  onSubmit: Submit;
}) {
  return (
    <section className="u-panel u-security-panel">
      <h2>أمان حسابي</h2>
      <p>
        {user.name} · {ROLE_LABELS[user.role]} · <bdi>{user.phone}</bdi>
      </p>
      <p className="u-muted">
        الجلسات النشطة: {sessionCount}. بعد تغيير كلمة المرور ستُسجَّل خروجك من
        جميع الأجهزة، بما فيها هذا الجهاز.
      </p>
      <form
        className="u-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await onSubmit({
            action: "change_password",
            currentPassword: f.get("currentPassword"),
            password: f.get("password"),
            confirmPassword: f.get("confirmPassword"),
          });
        }}
      >
        <label>
          كلمة المرور الحالية
          <input
            name="currentPassword"
            type="password"
            dir="ltr"
            required
            autoComplete="current-password"
          />
        </label>
        <NewPasswordFields />
        <p className="u-muted">
          لديك 3 محاولات للتحقق من كلمة المرور الحالية. بعد 3 محاولات خاطئة
          يتوقف التحقق لمدة 15 دقيقة.
        </p>
        <button className="u-primary" disabled={busy}>
          تغيير كلمة المرور والخروج من كل الأجهزة
        </button>
      </form>
      <details className="u-security-extra">
        <summary>تسجيل الخروج من جميع الأجهزة</summary>
        <form
          className="u-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await onSubmit({
              action: "logout_all_self",
              currentPassword: f.get("currentPassword"),
            });
          }}
        >
          <label>
            كلمة مرور حسابك
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button disabled={busy}>تأكيد تسجيل الخروج من كل الأجهزة</button>
        </form>
      </details>
      <p className="u-muted">
        نسيت كلمة المرور؟{" "}
        {user.role === "employee"
          ? "تواصل مع إدارة معرضك لإعادة تعيينها."
          : user.role === "manager"
            ? "تواصل مع الإدارة العامة لإعادة تعيينها."
            : "استخدم مسار استعادة حساب الإدارة لدى مسؤول النظام."}
      </p>
    </section>
  );
}

export function ShowroomAccountCards({
  rooms,
  onChoose,
}: {
  rooms: Showroom[];
  onChoose: (id: string) => void;
}) {
  return (
    <section className="u-account-rooms" aria-label="بيانات المعارض">
      {!rooms.length && <p>لا توجد معارض مسجلة.</p>}
      {rooms.map((room) => (
        <button
          key={room.id}
          className="u-account-room"
          onClick={() => onChoose(room.id)}
        >
          {room.logo_url ? (
            <img src={room.logo_url} alt="" />
          ) : (
            <span className="showroom-monogram">{room.name.slice(0, 1)}</span>
          )}
          <span className="u-account-room-info">
            <strong>{room.name}</strong>
            <span>
              رقم التواصل: <bdi>{room.phone || "غير محدد"}</bdi>
            </span>
            <span>
              دخول إدارة المعرض:{" "}
              <bdi>{room.manager_phones || "لا يوجد حساب إدارة"}</bdi>
            </span>
          </span>
          <span className="u-account-room-open">إدارة الحسابات ←</span>
        </button>
      ))}
    </section>
  );
}

type Operation =
  | "reset_password"
  | "toggle_staff"
  | "delete_staff"
  | "revoke_sessions";
export function AccountManagement({
  room,
  staff,
  admin,
  busy,
  onSubmit,
  message,
  clearMessage,
}: {
  room: Showroom;
  staff: Staff[];
  admin: boolean;
  busy: boolean;
  onSubmit: Submit;
  message: string;
  clearMessage: () => void;
}) {
  const [section, setSection] = useState<"manager" | "employee">(
    admin ? "manager" : "employee",
  );
  const [target, setTarget] = useState<Staff | null>(null);
  const [operation, setOperation] = useState<Operation>("reset_password");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (target && element && !element.open) element.showModal();
    return () => element?.close();
  }, [target]);
  const title =
    operation === "reset_password"
      ? "تغيير كلمة المرور"
      : operation === "delete_staff"
        ? "حذف الحساب"
        : operation === "revoke_sessions"
          ? "إخراج الحساب من جميع الأجهزة"
          : target?.active
            ? "تعطيل الحساب"
            : "تفعيل الحساب";
  const people = staff.filter(
    (s) => s.showroom_id === room.id && s.role === section,
  );
  function open(person: Staff, action: Operation) {
    clearMessage();
    setOperation(action);
    setTarget(person);
  }
  return (
    <>
      <div className="u-account-tabs" role="group" aria-label="نوع الحسابات">
        {admin && (
          <button
            className={section === "manager" ? "u-primary" : ""}
            aria-pressed={section === "manager"}
            onClick={() => setSection("manager")}
          >
            إدارة المعرض
          </button>
        )}
        <button
          className={section === "employee" ? "u-primary" : ""}
          aria-pressed={section === "employee"}
          onClick={() => setSection("employee")}
        >
          الموظفون
        </button>
      </div>
      <section className="u-panel">
        <div className="u-row">
          <h2>
            {section === "manager" ? "إدارة" : "موظفو"} {room.name}
          </h2>
          <span className="u-muted">{people.length} حساب</span>
        </div>
        <div className="u-account-list">
          {people.map((person) => (
            <article className="u-account-person" key={person.id}>
              <div className="u-account-person-info">
                <h3>{person.name}</h3>
                <span>
                  رقم الدخول: <bdi>{person.phone}</bdi>
                </span>
                <span>
                  {person.active ? "نشط" : "معطّل"} ·{" "}
                  {person.session_count || 0} جلسات نشطة
                </span>
              </div>
              <div className="u-account-actions">
                <button
                  disabled={busy}
                  onClick={() => open(person, "reset_password")}
                >
                  تغيير كلمة المرور
                </button>
                <button
                  disabled={busy}
                  className={person.active ? "u-danger" : "u-success"}
                  onClick={() => open(person, "toggle_staff")}
                >
                  {person.active ? "تعطيل" : "تفعيل"} الحساب
                </button>
                <button
                  disabled={busy}
                  onClick={() => open(person, "revoke_sessions")}
                >
                  خروج من كل الأجهزة
                </button>
                <button
                  disabled={busy}
                  className="u-danger"
                  onClick={() => open(person, "delete_staff")}
                >
                  حذف الحساب
                </button>
              </div>
            </article>
          ))}
          {!people.length && (
            <p className="u-muted">لا توجد حسابات في هذا القسم.</p>
          )}
        </div>
      </section>
      <section className="u-panel">
        <details key={section}>
          <summary>
            {section === "manager" ? "إضافة إداري للمعرض" : "إضافة موظف للمعرض"}
          </summary>
          <p className="u-muted">
            {section === "manager"
              ? "الحساب يدير خدمات هذا المعرض ومواعيده وموظفيه."
              : "الحساب يتابع مهام الصيانة المسندة إليه ضمن هذا المعرض."}
          </p>
          <StaffForm
            roomId={room.id}
            admin={admin}
            fixedRole={section}
            busy={busy}
            onSubmit={onSubmit}
          />
        </details>
      </section>
      <dialog
        ref={dialog}
        className="u-account-dialog"
        aria-labelledby="account-action-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setTarget(null);
        }}
      >
        {target && (
          <form
            key={target.id + operation}
            className="u-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await onSubmit({
                  action: operation,
                  staffId: target.id,
                  active: !target.active,
                  actorPassword: f.get("actorPassword"),
                  password: f.get("password"),
                  confirmPassword: f.get("confirmPassword"),
                  confirmDelete: f.get("confirmDelete") === "on",
                })
              )
                setTarget(null);
            }}
          >
            <h2 id="account-action-title">{title}</h2>
            <p>
              {target.name} · <bdi>{target.phone}</bdi>
              <br />
              {room.name}
            </p>
            {operation === "reset_password" && <NewPasswordFields />}
            {operation === "delete_staff" ? (
              <label className="u-check">
                <input name="confirmDelete" type="checkbox" required />
                أؤكد حذف الحساب. سيُمنع دخوله وتُغلق جلساته، مع حفظ سجل الطلبات
                وإعادة المهام التي لم يبدأها للإسناد. المهام الجاري تنفيذها تبقى
                في قائمة التسليم لمتابعتها من الإدارة.
              </label>
            ) : (
              <p className="u-muted">
                {operation === "reset_password"
                  ? "سيُسجَّل خروج هذا الحساب من كل الأجهزة بعد الحفظ."
                  : "سيُطلب من صاحب الحساب تسجيل الدخول مجددًا إذا كان حسابه مفعّلًا."}
              </p>
            )}
            <label>
              كلمة مرور حسابك أنت لتأكيد هويتك
              <input
                autoFocus
                name="actorPassword"
                type="password"
                dir="ltr"
                required
                autoComplete="current-password"
              />
            </label>
            <small>3 محاولات خاطئة تقفل التحقق لمدة 15 دقيقة.</small>
            {message && (
              <p role="alert" className="u-form-error">
                {message}
              </p>
            )}
            <div className="u-row">
              <button
                disabled={busy}
                className={
                  operation === "delete_staff" ? "u-danger" : "u-primary"
                }
              >
                {busy ? "جارٍ التنفيذ…" : "تأكيد"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setTarget(null)}
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
