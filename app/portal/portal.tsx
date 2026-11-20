// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
"use client";
import { FormEvent, useCallback, useEffect, useState, useRef } from "react";
import {
  Booking,
  Showroom,
  Staff,
  Service,
  STATUS_LABELS,
  ROLE_LABELS,
} from "../../lib/union/types";
import { ShowroomForm, ScheduleForm, ServiceForm } from "./forms";
import {
  MyAccount,
  ShowroomAccountCards,
  AccountManagement,
} from "./account-panels";
import BookingCard from "./booking-card";
import LoadingIndicator from "../loading-indicator";
import MfaPanel from "./mfa-panel";
import {
  DailyActions,
  SecurityEvents,
  type Operations,
} from "./operations-panel";
import "./portal.css";
type Role = "admin" | "manager" | "employee";
type Data = {
  user: Staff;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  operations: Operations | null;
  sessionCount: number;
  showrooms: Showroom[];
  staff: Staff[];
  requestTypes: Service[];
  bookings: Booking[];
  counts: Record<string, number> | null;
  selectedShowroomId: string;
  total: number;
  page: number;
  pageSize: number;
};
const titles: Record<string, string> = {
  overview: "نظرة عامة",
  showrooms: "المعارض",
  bookings: "الحجوزات",
  staff: "الحسابات والموظفون",
  services: "خدمات الصيانة",
  settings: "المواعيد والسعة",
  security: "أمان حسابي",
  audit: "سجل العمليات والأمان",
};
async function jsonRequest(path: string, body?: Record<string, unknown>) {
  let multipart: FormData | undefined;
  if (body?.logoFile instanceof File) {
    const { logoFile, ...payload } = body;
    multipart = new FormData();
    multipart.set("payload", JSON.stringify(payload));
    multipart.set("logoFile", logoFile);
  }
  const r = await fetch(path, {
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: multipart
            ? undefined
            : { "Content-Type": "application/json" },
          body: multipart || JSON.stringify(body),
        }
      : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "تعذر تنفيذ الطلب");
  return d;
}
export default function Portal({ role }: { role: Role }) {
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState(role === "employee" ? "bookings" : "overview");
  const [selected, setSelected] = useState(""),
    [filters, setFilters] = useState({
      q: "",
      date: "",
      status: "",
      employeeId: "",
    }),
    [page, setPage] = useState(1),
    [mobile, setMobile] = useState(false);
  const [queue, setQueue] = useState("");
  const [editing, setEditing] = useState(false);
  const [addingShowroom, setAddingShowroom] = useState(false);
  const requestSequence = useRef(0);
  const query = new URLSearchParams({
    scope: role,
    queue,
    showroomId: selected,
    page: String(page),
    ...filters,
  }).toString();
  const load = useCallback(async () => {
    const seq = ++requestSequence.current;
    const r = await fetch("/api/portal?" + query, { cache: "no-store" });
    const d = await r.json();
    if (seq !== requestSequence.current) return;
    if (r.status === 401 || r.status === 403) {
      setData(null);
      if (r.status === 403) setMessage(d.error);
      return;
    }
    if (!r.ok) throw new Error(d.error || "تعذر تحميل البيانات");
    setData(d);
  }, [query]);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      load()
        .catch((e) => {
          if (live) setMessage(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    });
    return () => {
      live = false;
    };
  }, [load]);
  useEffect(() => {
    if (!data || tab === "security") return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible")
        void load().catch((e) => setMessage(e.message));
    }, 15000);
    return () => window.clearInterval(t);
  }, [data, load, tab]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      await jsonRequest("/api/auth/login", {
        phone: f.get("phone"),
        password: f.get("password"),
        expectedRole: role,
        code: f.get("code"),
      });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذر الدخول");
    } finally {
      setBusy(false);
    }
  }
  async function action(payload: Record<string, unknown>) {
    if (data?.user.read_only) {
      setMessage("حساب عرض تجريبي: التعديل غير مسموح");
      return false;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await jsonRequest("/api/portal", payload);
      if (result.signedOut) {
        requestSequence.current++;
        setData(null);
        setSelected("");
        setTab(role === "employee" ? "bookings" : "overview");
        setMobile(false);
        setMessage(
          "تم حفظ التغيير وتسجيل خروجك من جميع الأجهزة. ادخل مجددًا بكلمة مرورك الحالية.",
        );
        return true;
      }
      await load();
      setMessage("تم حفظ التغيير بنجاح");
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذرت العملية");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setData(null);
      setMessage("");
    } catch {
      setMessage("تعذر تسجيل الخروج، حاول مجددًا");
    }
  }
  const admin = role === "admin",
    employee = role === "employee";
  const room = data?.showrooms.find(
    (s) => s.id === (admin ? selected : data.selectedShowroomId),
  );
  function choose(id: string) {
    setEditing(false);
    setQueue("");
    setSelected(id);
    setFilters({ q: "", date: "", status: "", employeeId: "" });
    setPage(1);
  }
  if (loading && !data)
    return (
      <main className="u-loading" dir="rtl">
        <div className="u-loading-panel">
          <div className="union-brand">
            <b>اتحاد الصيانة</b>
            <small>إربد</small>
          </div>
          <LoadingIndicator text="نجهّز بوابتك…" />
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="u-login" dir="rtl">
        <section className="u-login-side">
          <div className="union-brand">
            <b>اتحاد الصيانة</b>
            <small>اربد</small>
          </div>
          <div>
            <span>بوابة {ROLE_LABELS[role]}</span>
            <h1>
              {admin
                ? "إدارة واحدة، لكل المعارض."
                : employee
                  ? "مهام واضحة، وصيانة منظّمة."
                  : "معرضك ومواعيدك، بين إيديك."}
            </h1>
            <p>
              {admin
                ? "تابع المعارض والحجوزات وحدد صلاحيات كل حساب."
                : employee
                  ? "تفاصيل مهامك ومواقعها وتحديث حالة التنفيذ."
                  : "إدارة خدمات المعرض ومواعيده وطلبات الصيانة."}
            </p>
          </div>
        </section>
        <section className="u-login-panel">
          <form className="u-form" onSubmit={login}>
            <span className="eyebrow">{ROLE_LABELS[role]}</span>
            <h2>تسجيل الدخول</h2>
            <label>
              رقم الهاتف
              <input
                name="phone"
                type="tel"
                dir="ltr"
                required
                autoComplete="username"
                placeholder="07XXXXXXXX"
              />
            </label>
            <label>
              كلمة المرور
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              رمز تطبيق المصادقة أو الاسترداد (إذا فعّلته)
              <input
                name="code"
                dir="ltr"
                autoComplete="one-time-code"
                maxLength={40}
              />
            </label>
            {message && (
              <p className="u-message" role="alert">
                {message}
              </p>
            )}
            <button className="u-primary" disabled={busy}>
              {busy ? "جارٍ الدخول…" : "دخول"}
            </button>
          </form>
        </section>
      </main>
    );
  const tabs = employee
    ? ["bookings", "security"]
    : admin
      ? [
          "overview",
          "showrooms",
          "bookings",
          "staff",
          "services",
          "settings",
          "security",
          "audit",
        ]
      : ["overview", "bookings", "staff", "services", "settings", "security"];
  const titleFor = (t: string) =>
    t === "staff" && admin ? "بيانات المعارض" : titles[t];
  const roomName = (id: string) =>
    data.showrooms.find((s) => s.id === id)?.name || "";
  return (
    <main className="u-shell" dir="rtl">
      <aside className={`u-sidebar ${mobile ? "is-open" : ""}`}>
        <div className="union-brand">
          <b>اتحاد الصيانة</b>
          <small>اربد · {ROLE_LABELS[role]}</small>
        </div>
        <nav>
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                if (admin && (t === "staff" || t === "showrooms")) choose("");
                setAddingShowroom(false);
                setMobile(false);
              }}
            >
              {titleFor(t)}
            </button>
          ))}
        </nav>
        <div className="u-user">
          <strong>{data.user.name}</strong>
          <small>
            {role === "admin"
              ? "جميع المعارض"
              : roomName(data.user.showroom_id)}
          </small>
          <button onClick={logout}>تسجيل الخروج</button>
          <small dir="ltr">© 2026 Eng. Mohammad Twait</small>
        </div>
      </aside>
      {mobile && (
        <button
          className="u-overlay"
          aria-label="إغلاق القائمة"
          onClick={() => setMobile(false)}
        />
      )}
      <section className="u-main">
        {busy && data && (
          <div className="u-busy-indicator">
            <LoadingIndicator compact text="جارٍ حفظ التغيير…" />
          </div>
        )}
        <header className="u-top">
          <div className="u-row">
            <button
              className="u-mobile"
              onClick={() => setMobile(!mobile)}
              aria-label="القائمة"
            >
              ☰
            </button>
            <div>
              <span>{ROLE_LABELS[role]}</span>
              <h1>{titleFor(tab)}</h1>
            </div>
          </div>
          <div className="u-row">
            {admin && tab !== "security" && tab !== "showrooms" && (
              <label className="u-scope">
                المعرض
                <select
                  aria-label="المعرض"
                  value={selected}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option value="">جميع المعارض</option>
                  {data.showrooms.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.active ? "" : " — موقوف"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              disabled={busy || loading}
              onClick={() => load().catch((e) => setMessage(e.message))}
            >
              تحديث
            </button>
          </div>
        </header>
        {!!data.user.read_only && (
          <p className="u-message">
            حساب تجريبي للقراءة فقط. بيانات العملاء مخفية والتعديلات محظورة.
          </p>
        )}
        {message && (
          <div className="u-message" role="status">
            {message}
            <button aria-label="إغلاق الرسالة" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {room && tab !== "security" && (
          <div className="u-room-banner">
            <div>
              {room.logo_url ? (
                <img
                  src={room.logo_url}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="showroom-monogram">
                  {room.name.slice(0, 1)}
                </span>
              )}
              <div>
                <strong>{room.name}</strong>
                <p>
                  {room.city} — {room.address}
                </p>
              </div>
            </div>
            <span>
              {room.active ? "يستقبل حجوزات" : "استقبال الحجوزات موقوف"}
            </span>
          </div>
        )}
        {room && !employee && !["security", "audit"].includes(tab) && (
          <nav className="u-workspace-tabs" aria-label="أقسام ملف المعرض">
            {(admin
              ? ["showrooms", "bookings", "staff", "services", "settings"]
              : ["overview", "bookings", "staff", "services", "settings"]
            ).map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => {
                  setTab(t);
                  setEditing(false);
                  setAddingShowroom(false);
                }}
              >
                {t === "showrooms" ? "بيانات المعرض" : titles[t]}
              </button>
            ))}
          </nav>
        )}
        {tab === "audit" && admin && data.operations && (
          <SecurityEvents events={data.operations.events} />
        )}
        {tab === "overview" && (
          <>
            {data.operations && (
              <DailyActions
                data={data.operations}
                onQueue={(q) => {
                  setFilters({
                    q: "",
                    date: "",
                    status: q === "approval" ? "pending_admin_approval" : "",
                    employeeId: "",
                  });
                  setQueue(q === "approval" ? "" : q);
                  setPage(1);
                  setTab("bookings");
                }}
              />
            )}
            {admin && !data.mfaEnabled && (
              <p className="u-message">
                حساب الإدارة غير محمي بالتحقق بخطوتين.{" "}
                <button onClick={() => setTab("security")}>
                  إعداد الحماية
                </button>
              </p>
            )}
            {admin && (
              <p className="u-muted">
                المعارض الموقوفة:{" "}
                {data.showrooms.filter((r) => !r.active).length}
              </p>
            )}
            <div className="u-stats">
              {[
                ["حجوزات اليوم", data.counts?.today],
                ["بانتظار الاعتماد", data.counts?.pending_approval],
                ["طلبات مكتملة", data.counts?.completed],
                ["إجمالي الطلبات", data.counts?.total],
              ].map(([label, value]) => (
                <article key={String(label)}>
                  <span>{label}</span>
                  <strong>{Number(value || 0)}</strong>
                </article>
              ))}
            </div>
            <section className="u-panel">
              <h2>{room ? "طلبات " + room.name : "حركة الصيانة في المعارض"}</h2>
              <p className="u-muted">
                {data.showrooms.length} معرض ·{" "}
                {
                  data.staff.filter((s) => s.active && s.role === "employee")
                    .length
                }{" "}
                موظف نشط
              </p>
              <button className="u-primary" onClick={() => setTab("bookings")}>
                عرض الحجوزات وإدارتها
              </button>
            </section>
            {room && (
              <section className="u-panel">
                <h2>جدول استقبال الطلبات</h2>
                <p>
                  {room.booking_duration_minute} دقيقة لكل موعد ·{" "}
                  {room.teams_count} فرق · حتى {room.daily_booking_limit} حجز في
                  اليوم
                </p>
                <button onClick={() => setTab("settings")}>
                  تعديل المواعيد والسعة
                </button>
              </section>
            )}
          </>
        )}
        {tab === "showrooms" && admin && (
          <>
            {addingShowroom ? (
              <section className="u-panel">
                <div className="u-row">
                  <h2>إضافة معرض وحساب صاحبه</h2>
                  <button onClick={() => setAddingShowroom(false)}>
                    العودة للمعارض
                  </button>
                </div>
                <ShowroomForm
                  busy={busy || !!data.user.read_only}
                  onSubmit={action}
                />
              </section>
            ) : !room ? (
              <section className="u-panel">
                <div className="u-row">
                  <h2>المعارض المسجلة</h2>
                  <button
                    className="u-primary"
                    onClick={() => {
                      choose("");
                      setAddingShowroom(true);
                    }}
                  >
                    إضافة معرض
                  </button>
                </div>
                {!data.showrooms.length && <p>ابدأ بإضافة معرض.</p>}
                <div className="u-showrooms">
                  {data.showrooms.map((s) => (
                    <article key={s.id}>
                      {s.logo_url ? (
                        <img
                          src={s.logo_url}
                          alt={s.name}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="showroom-monogram">
                          {s.name.slice(0, 1)}
                        </span>
                      )}
                      <h3>{s.name}</h3>
                      <p>
                        {s.city} — {s.address}
                      </p>
                      <span>{s.active ? "نشط" : "موقوف"}</span>
                      <button
                        onClick={() => {
                          choose(s.id);
                        }}
                      >
                        فتح ملف المعرض
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="u-panel">
                <div className="u-row">
                  <h2>{editing ? `تعديل ${room.name}` : `ملف ${room.name}`}</h2>
                  <button
                    onClick={() => {
                      choose("");
                      setEditing(false);
                    }}
                  >
                    العودة لقائمة المعارض
                  </button>
                </div>
                {editing ? (
                  <>
                    <button disabled={busy} onClick={() => setEditing(false)}>
                      إلغاء التعديل
                    </button>
                    <ShowroomForm
                      key={`${room.id}:${room.logo_url}:${room.updated_at}`}
                      room={room}
                      busy={busy || !!data.user.read_only}
                      onSubmit={action}
                    />
                  </>
                ) : (
                  <>
                    <p>
                      رقم التواصل: <bdi>{room.phone}</bdi>
                    </p>
                    <p>
                      العنوان: {room.city} — {room.address}
                    </p>
                    <p>
                      الحالة:{" "}
                      {room.active
                        ? "يستقبل الحجوزات"
                        : "استقبال الحجوزات موقوف"}
                    </p>
                    <button onClick={() => setEditing(true)}>
                      تعديل بيانات المعرض والشعار
                    </button>
                    <div className="u-sensitive-actions">
                      <h3>التحكم باستقبال الحجوزات</h3>
                      <p className="u-muted">
                        الإيقاف يمنع حجوزات جديدة فقط؛ الطلبات الحالية محفوظة.
                      </p>
                      <button
                        disabled={busy}
                        className={room.active ? "u-danger" : "u-success"}
                        onClick={() => {
                          if (
                            window.confirm(
                              room.active
                                ? `هل تريد إيقاف حجوزات ${room.name} الجديدة؟`
                                : `هل تريد إعادة تفعيل حجوزات ${room.name}؟`,
                            )
                          )
                            action({
                              action: "toggle_showroom",
                              showroomId: room.id,
                              active: !room.active,
                            });
                        }}
                      >
                        {room.active ? "إيقاف المعرض" : "إعادة تفعيل المعرض"}
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
        {tab === "bookings" && (
          <>
            <section className="u-panel">
              <form
                className="u-filters"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setQueue("");
                  setFilters({
                    q: String(f.get("q") || ""),
                    date: String(f.get("date") || ""),
                    status: String(f.get("status") || ""),
                    employeeId: String(f.get("employeeId") || ""),
                  });
                  setPage(1);
                }}
                key={selected + JSON.stringify(filters) + queue}
              >
                <label>
                  بحث
                  <input
                    name="q"
                    placeholder="اسم، هاتف أو رقم طلب"
                    defaultValue={filters.q}
                  />
                </label>
                <label>
                  التاريخ
                  <input type="date" name="date" defaultValue={filters.date} />
                </label>
                <label>
                  الحالة
                  <select name="status" defaultValue={filters.status}>
                    <option value="">كل الحالات</option>
                    {Object.entries(STATUS_LABELS).map(([id, name]) => (
                      <option value={id} key={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {!employee && (
                  <label>
                    الموظف
                    <select name="employeeId" defaultValue={filters.employeeId}>
                      <option value="">جميع الموظفين</option>
                      {data.staff
                        .filter((s) => s.role === "employee")
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} — {roomName(s.showroom_id)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <button className="u-primary" disabled={loading}>
                  تطبيق البحث
                </button>
                <button
                  type="reset"
                  onClick={() => {
                    setQueue("");
                    setFilters({ q: "", date: "", status: "", employeeId: "" });
                    setPage(1);
                  }}
                >
                  مسح
                </button>
              </form>
            </section>
            <p className="u-muted">
              {data.total} طلب مطابق {queue && "· قائمة المتابعة"}
            </p>
            <div className="u-bookings">
              {data.bookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  readOnly={!!data.user.read_only}
                  staff={data.staff}
                  employee={employee}
                  busy={busy || !!data.user.read_only}
                  onSubmit={action}
                />
              ))}
            </div>
            {!data.bookings.length && (
              <div className="u-empty">
                لا توجد طلبات مطابقة. جرّب تغيير الفلاتر أو إضافة حجز جديد.
              </div>
            )}
            <div className="u-pagination">
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                السابق
              </button>
              <span>
                صفحة {page} من {Math.max(1, Math.ceil(data.total / 50))}
              </span>
              <button
                disabled={page * 50 >= data.total || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </button>
            </div>
          </>
        )}
        {tab === "staff" && !employee && (
          <>
            {admin && !room ? (
              <ShowroomAccountCards rooms={data.showrooms} onChoose={choose} />
            ) : room && data.user.read_only ? (
              <section className="u-panel">
                <h2>حسابات المعرض</h2>
                <p>إدارة الحسابات مخفية في وضع العرض التجريبي.</p>
                {data.staff.map((s) => (
                  <p key={s.id}>
                    {ROLE_LABELS[s.role]} · {s.active ? "نشط" : "موقوف"}
                  </p>
                ))}
              </section>
            ) : room ? (
              <>
                {admin && (
                  <button className="u-back-rooms" onClick={() => choose("")}>
                    الرجوع إلى بيانات المعارض
                  </button>
                )}
                <AccountManagement
                  key={room.id}
                  room={room}
                  staff={data.staff}
                  admin={admin}
                  busy={busy || !!data.user.read_only}
                  onSubmit={action}
                  message={message}
                  clearMessage={() => setMessage("")}
                />
              </>
            ) : (
              <p>اختر المعرض لإدارة حساباته.</p>
            )}
          </>
        )}
        {tab === "security" && !!data.user.read_only && (
          <section className="u-panel">
            إعدادات الأمان غير متاحة في حساب العرض. تواصل مع المسؤول عن الحساب.
          </section>
        )}
        {tab === "security" && !data.user.read_only && (
          <>
            {!data.user.read_only && (
              <MfaPanel enabled={data.mfaEnabled} required={data.mfaRequired} />
            )}
            <MyAccount
              user={data.user}
              sessionCount={data.sessionCount}
              busy={busy || !!data.user.read_only}
              onSubmit={action}
            />
          </>
        )}
        {tab === "services" && (
          <div className="u-grid2">
            <section className="u-panel">
              <h2>إضافة خدمة {room ? "— " + room.name : ""}</h2>
              {room && !data.user.read_only ? (
                <ServiceForm
                  key={room.id}
                  roomId={room.id}
                  busy={busy || !!data.user.read_only}
                  onSubmit={action}
                />
              ) : (
                <p>اختر معرضًا لإضافة خدماته.</p>
              )}
            </section>
            <section className="u-panel">
              <h2>خدمات الصيانة</h2>
              {data.requestTypes.map((t) => (
                <article className="u-service" key={t.id}>
                  <div>
                    <strong>{t.name_ar}</strong>
                    <small>
                      {t.name_en} · {roomName(t.showroom_id)}
                    </small>
                  </div>
                  <label className="u-check">
                    <input
                      aria-label={"نشر " + t.name_ar}
                      type="checkbox"
                      disabled={busy}
                      checked={!!t.published}
                      onChange={(e) =>
                        action({
                          action: "toggle_request_type",
                          typeId: t.id,
                          published: e.target.checked,
                        })
                      }
                    />{" "}
                    منشورة
                  </label>
                </article>
              ))}
              {!data.requestTypes.length && (
                <p>أضف خدمة حتى يستطيع الزبون حجزها.</p>
              )}
            </section>
          </div>
        )}
        {tab === "settings" && (
          <section className="u-panel">
            <h2>المواعيد والسعة {room ? "— " + room.name : ""}</h2>
            {room && data.user.read_only ? (
              <p>
                {room.teams_count} فرق · {room.booking_duration_minute} دقيقة
                لكل موعد · حد يومي {room.daily_booking_limit}. التعديل غير متاح
                للحساب التجريبي.
              </p>
            ) : room ? (
              <ScheduleForm
                key={room.id + room.updated_at}
                room={room}
                busy={busy || !!data.user.read_only}
                onSubmit={action}
              />
            ) : (
              <p>اختر المعرض من القائمة العلوية لتعديل مواعيده.</p>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
