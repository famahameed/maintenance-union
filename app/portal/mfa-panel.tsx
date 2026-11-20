// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
"use client";
import { useState } from "react";
import LoadingIndicator from "../loading-indicator";

export default function MfaPanel({
  enabled,
  required = false,
}: {
  enabled: boolean;
  required?: boolean;
}) {
  const [secret, setSecret] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement, action: string) {
    setBusy(true);
    setMessage("");
    const f = new FormData(form);
    try {
      const r = await fetch("/api/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          currentPassword: f.get("password"),
          code: f.get("code"),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "تعذر تغيير إعداد الأمان");
      form.reset();
      if (data.secret) setSecret(data.secret);
      if (data.recoveryCodes) {
        setCodes(data.recoveryCodes);
        setSecret("");
      } else if (data.signedOut) window.location.reload();
      setMessage(
        data.secret
          ? "أضف المفتاح إلى تطبيق المصادقة ثم أدخل الرمز للتأكيد خلال 10 دقائق."
          : "تم التفعيل وتسجيل الخروج من جميع الأجهزة. احفظ رموز الاسترداد قبل المتابعة.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذرت العملية");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="u-panel u-security-panel">
      <h2>التحقق بخطوتين</h2>
      <p>
        الحالة: {enabled ? "مفعّل" : "غير مفعّل"}. احمِ حسابك بكلمة المرور ورمز
        من تطبيق مصادقة على هاتفك.
      </p>
      {message && (
        <p role="status" className="u-message">
          {message}
        </p>
      )}
      {busy && <LoadingIndicator compact text="جارٍ تأمين الحساب…" />}
      {required && enabled ? (
        <p className="u-muted">
          التحقق بخطوتين مطلوب لحساب الإدارة العامة أثناء التشغيل الفعلي.
        </p>
      ) : codes.length ? (
        <>
          <h3>رموز الاسترداد — تظهر مرة واحدة</h3>
          <p>
            احفظها في مدير كلمات المرور؛ كل رمز يُستخدم مرة واحدة مع كلمة مرور
            حسابك عند فقدان الهاتف.
          </p>
          <textarea
            aria-label="رموز الاسترداد"
            readOnly
            rows={8}
            dir="ltr"
            value={codes.join("\n")}
            onFocus={(e) => e.target.select()}
          />
          <button
            className="u-primary"
            onClick={() => window.location.reload()}
          >
            حفظت الرموز — تسجيل الدخول
          </button>
        </>
      ) : (
        <>
          {secret && (
            <div>
              <p>
                في تطبيق المصادقة اختر إضافة مفتاح إعداد يدوي، نوعه زمني (TOTP)،
                باسم اتحاد الصيانة.
              </p>
              <input
                aria-label="مفتاح المصادقة"
                dir="ltr"
                readOnly
                value={secret}
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
          <form
            className="u-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(
                e.currentTarget,
                enabled ? "mfa_disable" : secret ? "mfa_enable" : "mfa_setup",
              );
            }}
          >
            <label>
              كلمة المرور الحالية
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {(enabled || secret) && (
              <label>
                رمز التطبيق {enabled && "أو رمز الاسترداد"}
                <input
                  name="code"
                  autoComplete="one-time-code"
                  dir="ltr"
                  required
                  maxLength={40}
                />
              </label>
            )}
            <button
              disabled={busy}
              className={enabled ? "u-danger" : "u-primary"}
            >
              {enabled
                ? "تعطيل التحقق بخطوتين والخروج"
                : secret
                  ? "تأكيد التفعيل وإظهار رموز الاسترداد"
                  : "بدء إعداد التحقق بخطوتين"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
