// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
"use client";
import { useState, useEffect, useRef } from "react";
import { normalizeLogo } from "./normalize-logo";
import type { Showroom } from "../../lib/union/types";
import { timeLabel } from "../../lib/union/types";
import {
  validManagerPassword,
  MANAGER_PASSWORD_HINT,
} from "../../lib/union/password";
export type Submit = (payload: Record<string, unknown>) => Promise<boolean>;
export function ShowroomForm({
  room,
  busy,
  onSubmit,
}: {
  room?: Showroom;
  busy: boolean;
  onSubmit: Submit;
}) {
  const [preparingLogo, setPreparingLogo] = useState(false);
  const logoSequence = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState(room?.logo_url || "");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);
  function clearLogoFile() {
    logoSequence.current++;
    setPreparingLogo(false);
    setFile(null);
    setPreview("");
    if (picker.current) picker.current.value = "";
  }
  function generatePassword() {
    const groups = [
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      "abcdefghijklmnopqrstuvwxyz",
      "0123456789",
      "!@#$%&*?+-_",
    ];
    const all = groups.join("");
    const random = (max: number) => {
      const values = new Uint32Array(1),
        limit = Math.floor(0x100000000 / max) * max;
      do {
        crypto.getRandomValues(values);
      } while (values[0] >= limit);
      return values[0] % max;
    };
    const chars = groups.map((g) => g[random(g.length)]);
    while (chars.length < 16) chars.push(all[random(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    setPassword(chars.join(""));
    setVisible(true);
  }
  return (
    <form
      className="u-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const el = e.currentTarget,
          f = new FormData(el);
        if (!room && !validManagerPassword(password)) {
          setError(MANAGER_PASSWORD_HINT);
          return;
        }
        if (
          await onSubmit({
            action: room ? "update_showroom" : "create_showroom",
            showroomId: room?.id,
            name: f.get("name"),
            nameEn: f.get("nameEn"),
            phone: f.get("phone"),
            city: f.get("city"),
            address: f.get("address"),
            logoUrl,
            ...(!room
              ? {
                  loginPhone: f.get("loginPhone"),
                  password,
                  confirmPassword: f.get("confirmPassword"),
                  actorPassword: f.get("actorPassword"),
                }
              : {}),
            ...(file ? { logoFile: file } : {}),
          })
        ) {
          clearLogoFile();
          if (!room) {
            el.reset();
            setPassword("");
            setLogoUrl("");
          }
        }
      }}
    >
      <label>
        اسم المعرض
        <input
          name="name"
          required
          minLength={3}
          maxLength={100}
          defaultValue={room?.name}
        />
      </label>
      <label>
        الاسم بالإنجليزية
        <input name="nameEn" maxLength={100} defaultValue={room?.name_en} />
      </label>
      <label>
        رقم تواصل المعرض
        <input
          name="phone"
          type="tel"
          dir="ltr"
          required={!room}
          placeholder="07XXXXXXXX"
          defaultValue={room?.phone}
        />
        <small>رقم التواصل الذي يظهر للزبائن، وليس رقم تسجيل الدخول.</small>
      </label>
      {!room && (
        <fieldset className="u-form">
          <legend>حساب صاحب المعرض</legend>
          <label>
            رقم تسجيل الدخول
            <input
              name="loginPhone"
              type="tel"
              dir="ltr"
              required
              placeholder="رقم مختلف عن رقم التواصل"
              autoComplete="off"
            />
          </label>
          <label>
            كلمة المرور
            <input
              name="password"
              type={visible ? "text" : "password"}
              dir="ltr"
              required
              minLength={16}
              maxLength={16}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <small>{MANAGER_PASSWORD_HINT}</small>
          </label>
          <div className="u-row">
            <button type="button" onClick={generatePassword}>
              توليد كلمة مرور
            </button>
            <button type="button" onClick={() => setVisible(!visible)}>
              {visible ? "إخفاء" : "إظهار"} كلمة المرور
            </button>
          </div>
          <label>
            تأكيد كلمة مرور الحساب
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
          <label>
            كلمة مرور حسابك أنت لتأكيد هويتك
            <input
              name="actorPassword"
              type="password"
              dir="ltr"
              required
              autoComplete="current-password"
            />
          </label>
          <small>
            احفظ كلمة المرور قبل الإضافة لتسليمها لصاحب المعرض؛ لن تظهر بعد
            الحفظ.
          </small>
        </fieldset>
      )}
      <label>
        المدينة
        <input name="city" required defaultValue={room?.city || "إربد"} />
      </label>
      <label>
        عنوان المعرض
        <input
          name="address"
          required
          maxLength={180}
          defaultValue={room?.address}
        />
      </label>
      <label>
        رابط الشعار
        <div className="u-row">
          <input
            name="logoUrl"
            dir="ltr"
            placeholder="يظهر بعد حفظ الشعار"
            readOnly
            maxLength={500}
            value={logoUrl}
          />
          <button
            type="button"
            disabled={busy || preparingLogo}
            onClick={() => picker.current?.click()}
          >
            {room ? "تعديل الشعار" : "رفع شعار من الجهاز"}
          </button>
        </div>
      </label>
      <input
        ref={picker}
        className="u-file-picker"
        aria-label="اختيار صورة الشعار"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={async (e) => {
          const selected = e.target.files?.[0];
          setError("");
          if (!selected) return;
          if (
            !["image/png", "image/jpeg", "image/webp"].includes(
              selected.type,
            ) ||
            selected.size > 2 * 1024 * 1024 ||
            !selected.size
          ) {
            setError("اختر PNG أو JPG أو WebP بحجم لا يتجاوز 2 ميجابايت");
            e.target.value = "";
            return;
          }
          const seq = ++logoSequence.current;
          setPreparingLogo(true);
          try {
            const normalized = await normalizeLogo(selected);
            if (seq === logoSequence.current) {
              setFile(normalized);
              setPreview(URL.createObjectURL(normalized));
            }
          } catch (err) {
            if (seq === logoSequence.current) {
              setFile(null);
              setPreview("");
              setError(err instanceof Error ? err.message : "صورة غير سليمة");
            }
          } finally {
            if (seq === logoSequence.current) setPreparingLogo(false);
          }
        }}
      />
      <small>
        PNG أو JPG أو WebP، حتى 2 ميجابايت. تُجهّز الصورة تلقائيًا وتُزال
        بياناتها الإضافية. يُرفع الشعار ويُحفظ عند حفظ بيانات المعرض.
      </small>
      {preparingLogo && <p role="status">جارٍ تجهيز الشعار…</p>}
      {(preview || logoUrl) && (
        <img
          className="u-logo-preview"
          src={preview || logoUrl}
          alt="معاينة شعار المعرض"
        />
      )}
      {file && (
        <div className="u-row">
          <span>
            {file.name} · {Math.ceil(file.size / 1024)} كيلوبايت
          </span>
          <button
            type="button"
            onClick={() => {
              clearLogoFile();
            }}
          >
            إلغاء اختيار الصورة
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="u-form-error">
          {error}
        </p>
      )}
      <button className="u-primary" disabled={busy || preparingLogo}>
        {busy
          ? "جارٍ الحفظ…"
          : room
            ? "حفظ بيانات المعرض"
            : "إضافة المعرض وحساب صاحبه"}
      </button>
    </form>
  );
}
export function ScheduleForm({
  room,
  busy,
  onSubmit,
}: {
  room: Showroom;
  busy: boolean;
  onSubmit: Submit;
}) {
  const [days, setDays] = useState<number[]>(JSON.parse(room.work_days));
  const labels = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
  return (
    <form
      className="u-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          action: "save_settings",
          showroomId: room.id,
          workStartMinute: Number(f.get("start")),
          workEndMinute: Number(f.get("end")),
          bookingDurationMinute: Number(f.get("duration")),
          teamsCount: Number(f.get("teams")),
          dailyBookingLimit: Number(f.get("daily")),
          employeeDailyLimit: Number(f.get("employee")),
          workDays: days,
          homeServiceEnabled: f.get("home") === "on",
          shopServiceEnabled: f.get("shop") === "on",
          assignmentMode: f.get("assignment"),
        });
      }}
    >
      <fieldset>
        <legend>أيام استقبال الحجوزات</legend>
        <div className="u-days">
          {labels.map((name, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={days.includes(i)}
              onClick={() =>
                setDays((d) =>
                  d.includes(i) ? d.filter((x) => x !== i) : [...d, i],
                )
              }
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="u-grid2">
        <label>
          بداية المواعيد
          <select name="start" defaultValue={room.work_start_minute}>
            {Array.from({ length: 48 }, (_, i) => i * 30).map((n) => (
              <option key={n} value={n}>
                {timeLabel(n)}
              </option>
            ))}
          </select>
        </label>
        <label>
          نهاية المواعيد
          <select name="end" defaultValue={room.work_end_minute}>
            {Array.from({ length: 48 }, (_, i) => (i + 1) * 30).map((n) => (
              <option key={n} value={n}>
                {timeLabel(n)}
              </option>
            ))}
          </select>
        </label>
        <label>
          مدة كل موعد
          <select name="duration" defaultValue={room.booking_duration_minute}>
            {[30, 60, 90, 120, 150, 180, 210, 240].map((n) => (
              <option key={n} value={n}>
                {n} دقيقة
              </option>
            ))}
          </select>
        </label>
        <label>
          عدد الفرق / السعة المتزامنة
          <input
            name="teams"
            type="number"
            required
            min={1}
            max={20}
            defaultValue={room.teams_count}
          />
        </label>
        <label>
          الحد اليومي للحجوزات
          <input
            name="daily"
            type="number"
            required
            min={1}
            max={200}
            defaultValue={room.daily_booking_limit}
          />
        </label>
        <label>
          الحد اليومي لكل موظف
          <input
            name="employee"
            type="number"
            required
            min={1}
            max={20}
            defaultValue={room.employee_daily_limit}
          />
        </label>
      </div>
      <fieldset>
        <legend>مكان تنفيذ الصيانة</legend>
        <div className="u-row">
          <label className="u-check">
            <input
              type="checkbox"
              name="home"
              defaultChecked={!!room.home_service_enabled}
            />{" "}
            في المنزل
          </label>
          <label className="u-check">
            <input
              type="checkbox"
              name="shop"
              defaultChecked={!!room.shop_service_enabled}
            />{" "}
            في المعرض
          </label>
        </div>
      </fieldset>
      <label>
        توزيع المهام
        <select name="assignment" defaultValue={room.assignment_mode}>
          <option value="manual">يدوي — صاحب المعرض يختار الموظف</option>
          <option value="automatic">تلقائي — موظف متاح من نفس المعرض</option>
        </select>
      </label>
      <p className="u-muted">
        تطبق المواعيد الجديدة على الحجوزات الجديدة. الطلبات المحجوزة سابقًا تبقى
        بمواعيدها، وتُحتسب ضمن السعة.
      </p>
      <button className="u-primary" disabled={busy}>
        {busy ? "جارٍ الحفظ…" : "حفظ المواعيد والسعة"}
      </button>
    </form>
  );
}
export function StaffForm({
  roomId,
  admin,
  busy,
  onSubmit,
  fixedRole,
}: {
  roomId: string;
  admin: boolean;
  busy: boolean;
  onSubmit: Submit;
  fixedRole?: "manager" | "employee";
}) {
  return (
    <form
      className="u-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const el = e.currentTarget,
          f = new FormData(el);
        if (
          await onSubmit({
            action: "create_staff",
            showroomId: roomId,
            name: f.get("name"),
            phone: f.get("phone"),
            password: f.get("password"),
            confirmPassword: f.get("confirmPassword"),
            actorPassword: f.get("actorPassword"),
            role: fixedRole || f.get("role") || "employee",
            readOnly: f.get("readOnly") === "on",
          })
        )
          el.reset();
      }}
    >
      <label>
        الاسم
        <input name="name" required minLength={3} maxLength={80} />
      </label>
      <label>
        رقم الدخول
        <input
          name="phone"
          type="tel"
          dir="ltr"
          required
          placeholder="07XXXXXXXX"
          autoComplete="off"
        />
      </label>
      <label>
        كلمة المرور
        <input
          name="password"
          type="password"
          dir="ltr"
          minLength={16}
          maxLength={16}
          required
          autoComplete="new-password"
        />
        <small>{MANAGER_PASSWORD_HINT}</small>
      </label>
      <label>
        تأكيد كلمة المرور
        <input
          name="confirmPassword"
          type="password"
          dir="ltr"
          minLength={16}
          maxLength={16}
          required
          autoComplete="new-password"
        />
      </label>
      <label className="u-check">
        <input type="checkbox" name="readOnly" />
        حساب عرض تجريبي: قراءة فقط وبيانات العملاء مخفية
      </label>
      {admin && !fixedRole && (
        <label>
          الصلاحية
          <select name="role">
            <option value="employee">موظف صيانة</option>
            <option value="manager">إداري معرض</option>
          </select>
        </label>
      )}
      <label>
        كلمة مرور حسابك لتأكيد هويتك
        <input
          name="actorPassword"
          type="password"
          dir="ltr"
          required
          autoComplete="current-password"
        />
      </label>
      <small>لديك 3 محاولات للتحقق، ثم يتوقف التحقق لمدة 15 دقيقة.</small>
      <button className="u-primary" disabled={busy}>
        {busy ? "جارٍ الحفظ…" : "إنشاء الحساب"}
      </button>
    </form>
  );
}
export function ServiceForm({
  roomId,
  busy,
  onSubmit,
}: {
  roomId: string;
  busy: boolean;
  onSubmit: Submit;
}) {
  return (
    <form
      className="u-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const el = e.currentTarget,
          f = new FormData(el);
        if (
          await onSubmit({
            action: "add_request_type",
            showroomId: roomId,
            nameAr: f.get("ar"),
            nameEn: f.get("en"),
          })
        )
          el.reset();
      }}
    >
      <label>
        اسم الخدمة بالعربية
        <input name="ar" minLength={3} maxLength={100} required />
      </label>
      <label>
        اسم الخدمة بالإنجليزية
        <input name="en" minLength={3} maxLength={100} required />
      </label>
      <button className="u-primary" disabled={busy}>
        إضافة الخدمة
      </button>
    </form>
  );
}
