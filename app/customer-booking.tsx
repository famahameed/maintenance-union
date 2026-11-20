// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LoadingIndicator from "./loading-indicator";

type Language = "ar" | "en";
type RequestType = { id: number; name_ar: string; name_en: string };
type Slot = {
  minute: number;
  labelAr: string;
  labelEn: string;
  availableTeams: number;
};
type PublicShowroom = {
  id: string;
  name: string;
  name_en: string;
  logo_url: string;
  phone: string;
  city: string;
  address: string;
};
type Config = {
  showrooms: PublicShowroom[];
  showroom: PublicShowroom;
  business: {
    phone: string;
    email: string;
    cityAr: string;
    cityEn: string;
    addressAr: string;
    addressEn: string;
  };
  settings: {
    bookingDurationMinute: number;
    homeServiceEnabled: boolean;
    shopServiceEnabled: boolean;
  };
  requestTypes: RequestType[];
};
type FormState = {
  customerName: string;
  phone: string;
  whatsapp: boolean;
  requestTypeId: string;
  serviceMode: "home" | "shop";
  city: string;
  district: string;
  addressLine: string;
  latitude: string;
  longitude: string;
  googleMapsUrl: string;
  bookingDate: string;
  startMinute: string;
  notes: string;
};

const emptyRequestTypes: RequestType[] = [];

const copy = {
  ar: {
    navBooking: "احجز الآن",
    navHow: "كيف تعمل الخدمة؟",
    help: "مساعدة",
    availability: "اختر الموعد المتاح لك",
    title: "موعد صيانة جديد",
    subtitle: "أدخل التفاصيل خطوة بخطوة، وسنثبت الحجز مباشرة ضمن الوقت المتاح.",
    step: "الخطوة",
    of: "من",
    next: "متابعة",
    back: "رجوع",
    submit: "تأكيد طلب الصيانة",
    name: "الاسم الثلاثي باللغة العربية",
    nameHint: "أدخل اسمك من ثلاثة مقاطع",
    phone: "رقم الهاتف الأردني",
    whatsapp: "استخدام نفس الرقم للتواصل عبر واتساب",
    requestType: "نوع طلب الصيانة",
    choose: "اختر الخدمة",
    noServices: "لا توجد خدمات منشورة حالياً",
    mode: "مكان الصيانة",
    home: "في المنزل",
    shop: "في المعرض",
    city: "المدينة",
    district: "الحي",
    address: "وصف العنوان",
    cityHint: "مثال: إربد",
    districtHint: "مثال: الحي الشرقي",
    addressHint: "الشارع، أقرب معلم، رقم العمارة",
    locate: "استخدم موقعي الحالي",
    locating: "جارٍ تحديد موقعك…",
    map: "افتح خرائط Google",
    mapLink: "رابط الموقع من Google Maps — اختياري",
    locationSaved: "تم حفظ الإحداثيات مع الطلب",
    date: "تاريخ الصيانة",
    time: "الوقت المتاح",
    noSlots: "لا توجد مواعيد متاحة بهذا اليوم. اختر يوماً آخر.",
    notes: "ملاحظات وتفاصيل العطل",
    notesHint: "اكتب بالتفصيل ما الذي يحتاج إلى إصلاح…",
    summary: "راجع طلبك",
    edit: "يمكنك الرجوع لتعديل أي معلومة قبل التأكيد.",
    privacy:
      "تُعرض بيانات الطلب لإدارة الاتحاد وإدارة المعرض، وللموظف المسند إليه لتنفيذ الصيانة.",
    success: "تم استلام حجزك",
    successText:
      "احتفظ برقم الطلب. سيتواصل معك فريق المعرض لتأكيد تفاصيل الوصول.",
    reference: "رقم الطلب",
    another: "حجز طلب آخر",
    errorName: "اكتب اسماً عربياً صحيحاً من ثلاثة مقاطع.",
    errorPhone: "أدخل رقماً أردنياً يبدأ بـ 077 أو 078 أو 079.",
    errorRequired: "أكمل جميع الحقول المطلوبة.",
    errorLocation: "للصيانة المنزلية أضف وصف العنوان أو استخدم موقعك.",
    errorSubmit:
      "تعذر تثبيت الحجز. قد يكون الموعد حُجز قبل لحظات؛ اختر موعداً آخر.",
    closed: "الجمعة عطلة",
    contact: "للمساعدة",
    serviceTitle: "خدمة صيانة توصل لباب بيتك",
    serviceSubtitle: "صيانة منزلية أو داخل المعرض حسب نوع القطعة واختيارك.",
    benefit1: "المواعيد المتاحة حسب سعة فريق المعرض",
    benefit2: "صاحب المعرض يحدد المواعيد وسعة الحجز",
    benefit3: "تواصل مع المعرض بالهاتف أو واتساب",
  },
  en: {
    navBooking: "Book now",
    navHow: "How it works",
    help: "Help",
    availability: "Choose an available appointment",
    title: "New maintenance booking",
    subtitle:
      "Enter the details step by step. Your available time is reserved immediately.",
    step: "Step",
    of: "of",
    next: "Continue",
    back: "Back",
    submit: "Confirm maintenance request",
    name: "Arabic full name (3 parts)",
    nameHint: "Enter three Arabic name parts",
    phone: "Jordanian mobile number",
    whatsapp: "Use the same number for WhatsApp",
    requestType: "Maintenance request",
    choose: "Choose a service",
    noServices: "No services are currently published",
    mode: "Service location",
    home: "At home",
    shop: "At the showroom",
    city: "City",
    district: "District",
    address: "Address details",
    cityHint: "Example: Irbid",
    districtHint: "Example: Al Sharqi",
    addressHint: "Street, landmark, building number",
    locate: "Use my current location",
    locating: "Locating…",
    map: "Open Google Maps",
    mapLink: "Google Maps shared link — optional",
    locationSaved: "Coordinates saved with your request",
    date: "Maintenance date",
    time: "Available time",
    noSlots: "No times are available on this day. Choose another date.",
    notes: "Damage details and notes",
    notesHint: "Describe exactly what needs to be repaired…",
    summary: "Review your request",
    edit: "You can go back to edit any detail before confirming.",
    privacy:
      "Your phone and location are visible only to the manager and the employee assigned to your booking.",
    success: "Your booking was received",
    successText:
      "Keep your reference number. The showroom team will contact you to confirm arrival details.",
    reference: "Reference",
    another: "Book another request",
    errorName: "Enter a valid Arabic name made of exactly three parts.",
    errorPhone: "Enter a Jordanian number starting with 077, 078, or 079.",
    errorRequired: "Complete all required fields.",
    errorLocation: "For home service, add an address or use your location.",
    errorSubmit:
      "The time may have just been booked. Please choose another time.",
    closed: "Friday closed",
    contact: "Help",
    serviceTitle: "Furniture maintenance at your doorstep",
    serviceSubtitle:
      "Home or showroom service based on the item and your choice.",
    benefit1: "Appointments reflect showroom team capacity",
    benefit2: "The manager controls duration and daily capacity",
    benefit3: "Contact your showroom by phone or WhatsApp",
  },
} as const;

const initialForm: FormState = {
  customerName: "",
  phone: "",
  whatsapp: true,
  requestTypeId: "",
  serviceMode: "home",
  city: "إربد",
  district: "",
  addressLine: "",
  latitude: "",
  longitude: "",
  googleMapsUrl: "",
  bookingDate: "",
  startMinute: "",
  notes: "",
};

function todayInJordan() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizedPhone(value: string) {
  let phone = value.replace(/[^\d+]/g, "");
  if (phone.startsWith("+962")) phone = `0${phone.slice(4)}`;
  return phone;
}

export default function CustomerBooking() {
  const [language, setLanguage] = useState<Language>("ar");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [showroomId, setShowroomId] = useState("");
  const [showrooms, setShowrooms] = useState<PublicShowroom[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState("");
  const [reload, setReload] = useState(0);
  const [config, setConfig] = useState<Config | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pendingSubmission = useRef({ payload: "", key: "" });
  const [reference, setReference] = useState("");
  const t = copy[language];
  const isArabic = language === "ar";
  const requestTypes = config?.requestTypes ?? emptyRequestTypes;

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/config${showroomId ? `?showroomId=${encodeURIComponent(showroomId)}` : ""}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      })
      .then((data: Config) => {
        setShowrooms(data.showrooms);
        if (showroomId) {
          setConfig(data);
          setForm((current) => ({
            ...current,
            serviceMode: data.settings.homeServiceEnabled ? "home" : "shop",
          }));
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setConfigError(
            isArabic
              ? "تعذر تحميل المعارض والخدمات. حاول مرة أخرى."
              : "Unable to load showrooms. Try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingConfig(false);
      });
    return () => controller.abort();
  }, [showroomId, reload, isArabic]);

  useEffect(() => {
    if (!form.bookingDate || !showroomId) return;
    const controller = new AbortController();
    fetch(
      `/api/availability?date=${encodeURIComponent(form.bookingDate)}&mode=${form.serviceMode}&showroomId=${encodeURIComponent(showroomId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setSlots([]);
          setError(
            isArabic
              ? "تعذر تحميل المواعيد، حاول اختيار التاريخ مجددًا."
              : "Unable to load appointments.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });
    return () => controller.abort();
  }, [form.bookingDate, form.serviceMode, showroomId, isArabic]);

  const selectedType = useMemo(
    () => requestTypes.find((item) => String(item.id) === form.requestTypeId),
    [form.requestTypeId, requestTypes],
  );
  const selectedSlot = slots.find(
    (slot) => String(slot.minute) === form.startMinute,
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function selectMode(mode: "home" | "shop") {
    setForm((current) => ({ ...current, serviceMode: mode, startMinute: "" }));
    setSlots([]);
    if (form.bookingDate) setLoadingSlots(true);
    setError("");
  }

  function selectDate(date: string) {
    setForm((current) => ({ ...current, bookingDate: date, startMinute: "" }));
    setSlots([]);
    setLoadingSlots(Boolean(date));
    setError("");
  }

  function validateCurrentStep() {
    if (!config) {
      setError(
        isArabic ? "انتظر تحميل خدمات المعرض" : "Wait for showroom services",
      );
      return false;
    }
    if (step === 1) {
      const nameParts = form.customerName.trim().split(/\s+/);
      if (
        nameParts.length !== 3 ||
        !nameParts.every((part) =>
          /^[\p{Script=Arabic}ء-ي][\p{Script=Arabic}\p{M}ء-ي'-]{1,29}$/u.test(
            part,
          ),
        )
      ) {
        setError(t.errorName);
        return false;
      }
      if (!/^07[789]\d{7}$/.test(normalizedPhone(form.phone))) {
        setError(t.errorPhone);
        return false;
      }
      if (!form.requestTypeId || !form.serviceMode) {
        setError(t.errorRequired);
        return false;
      }
    }
    if (step === 2) {
      if (!form.city.trim() || !form.district.trim()) {
        setError(t.errorRequired);
        return false;
      }
      if (
        form.serviceMode === "home" &&
        !form.addressLine.trim() &&
        !form.latitude &&
        !form.googleMapsUrl.trim()
      ) {
        setError(t.errorLocation);
        return false;
      }
    }
    if (step === 3 && (!form.bookingDate || !form.startMinute)) {
      setError(t.errorRequired);
      return false;
    }
    return true;
  }

  function nextStep() {
    if (validateCurrentStep())
      setStep((current) =>
        current === 1 && form.serviceMode === "shop"
          ? 3
          : Math.min(4, current + 1),
      );
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError(t.errorLocation);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError(t.errorLocation);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  async function submitBooking() {
    setSubmitting(true);
    setError("");
    try {
      const payload = JSON.stringify({ ...form, showroomId });
      if (pendingSubmission.current.payload !== payload)
        pendingSubmission.current = { payload, key: crypto.randomUUID() };
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requestId: pendingSubmission.current.key,
          showroomId,
          phone: normalizedPhone(form.phone),
          requestTypeId: Number(form.requestTypeId),
          startMinute: Number(form.startMinute),
        }),
      });
      const data = await response.json();
      if (response.status === 409) {
        setForm((current) => ({ ...current, startMinute: "" }));
        setStep(3);
      }
      if (!response.ok) throw new Error(data.error || "booking failed");
      setReference(data.reference);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorSubmit);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="customer-page" dir={isArabic ? "rtl" : "ltr"}>
      <header className="customer-header">
        <a href="/" className="union-brand">
          <b>{isArabic ? "اتحاد الصيانة" : "Maintenance Union"}</b>
          <small>{isArabic ? "اربد" : "Irbid"}</small>
        </a>
        <nav aria-label={isArabic ? "التنقل الرئيسي" : "Main navigation"}>
          <a href="#booking">{t.navBooking}</a>
          <a href="#how">{t.navHow}</a>
        </nav>
        <div className="header-tools">
          {config?.showroom.phone && (
            <a
              className="header-phone"
              href={`tel:${config.showroom.phone}`}
              dir="ltr"
            >
              {config.showroom.phone}
            </a>
          )}
          <button
            type="button"
            className="language-button"
            onClick={() => setLanguage(isArabic ? "en" : "ar")}
          >
            {isArabic ? "EN" : "العربية"}
          </button>
        </div>
      </header>

      <section id="booking" className="booking-layout">
        <aside className="booking-photo-panel">
          <img
            src="/assets/furniture-maintenance.jpg"
            alt={
              isArabic
                ? "كنبة حديثة في غرفة معيشة"
                : "Modern sofa in a living room"
            }
          />
          <div className="photo-overlay" />
          <div className="photo-copy">
            <span>{t.availability}</span>
            <h2>{t.serviceTitle}</h2>
            <p>{t.serviceSubtitle}</p>
          </div>
          <div className="photo-contact">
            <span>
              {isArabic
                ? "معرضك، خدمتك، موعدك"
                : "Your showroom. Your appointment."}
            </span>
          </div>
        </aside>

        <section className="booking-form-panel">
          {step > 0 && step < 5 && (
            <div className="booking-heading">
              <span>{t.navBooking}</span>
              <h1>{t.title}</h1>
              <p>{t.subtitle}</p>
            </div>
          )}
          {step > 0 && step < 5 && (
            <div
              className="step-progress"
              aria-label={`${t.step} ${step} ${t.of} 4`}
            >
              <div>
                <span>
                  {t.step} {step} {t.of} 4
                </span>
                <b>{Math.round((step / 4) * 100)}%</b>
              </div>
              <i>
                <em style={{ width: `${(step / 4) * 100}%` }} />
              </i>
            </div>
          )}

          {showroomId && (
            <div className="selected-showroom">
              <div>
                {config?.showroom.logo_url ? (
                  <img
                    src={config.showroom.logo_url}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="showroom-monogram">
                    {(config?.showroom.name || "م").slice(0, 1)}
                  </span>
                )}
                <div>
                  <small>
                    {isArabic ? "المعرض المختار" : "Selected showroom"}
                  </small>
                  <strong>
                    {config?.showroom.name ||
                      showrooms.find((s) => s.id === showroomId)?.name}
                  </strong>
                </div>
              </div>
              {step < 5 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setStep(0);
                    setShowroomId("");
                    setLoadingConfig(true);
                    setConfigError("");
                    setConfig(null);
                    setForm((current) => ({
                      ...current,
                      requestTypeId: "",
                      bookingDate: "",
                      startMinute: "",
                    }));
                    setSlots([]);
                    setError("");
                  }}
                >
                  {isArabic ? "تغيير" : "Change"}
                </button>
              )}
            </div>
          )}
          {configError && (
            <div className="form-error" role="alert">
              {configError}{" "}
              <button
                type="button"
                onClick={() => {
                  setLoadingConfig(true);
                  setConfigError("");
                  setReload((r) => r + 1);
                }}
              >
                {isArabic ? "إعادة المحاولة" : "Retry"}
              </button>
            </div>
          )}
          <form
            className="customer-form"
            onSubmit={(event) => event.preventDefault()}
          >
            {loadingConfig && step > 0 && step < 5 && (
              <LoadingIndicator
                text={
                  isArabic
                    ? "نجهّز خدمات المعرض…"
                    : "Loading showroom services…"
                }
              />
            )}
            {step === 0 && (
              <section className="showroom-picker">
                <span className="eyebrow">
                  {isArabic
                    ? "اتحاد الصيانة - اربد"
                    : "Maintenance Union — Irbid"}
                </span>
                <h1>
                  {isArabic ? "اختر معرض الأثاث" : "Choose your showroom"}
                </h1>
                <p>
                  {isArabic
                    ? "اختر المعرض لعرض خدمات الصيانة والمواعيد المتاحة لديه."
                    : "Select a showroom to see its services and appointments."}
                </p>
                {loadingConfig ? (
                  <LoadingIndicator
                    text={
                      isArabic
                        ? "نجهّز المعارض المتاحة…"
                        : "Loading available showrooms…"
                    }
                  />
                ) : showrooms.length ? (
                  <div className="showroom-grid">
                    {showrooms.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        className="showroom-card"
                        onClick={() => {
                          setLoadingConfig(true);
                          setConfigError("");
                          setConfig(null);
                          setShowroomId(s.id);
                          setStep(1);
                        }}
                      >
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
                        <strong>
                          {isArabic ? s.name : s.name_en || s.name}
                        </strong>
                        <small>
                          {s.city} · {s.address}
                        </small>
                        <span>
                          {isArabic ? "عرض الخدمات ←" : "View services →"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  !configError && (
                    <p>
                      {isArabic
                        ? "لا توجد معارض متاحة للحجز حاليًا."
                        : "No showrooms available."}
                    </p>
                  )
                )}
              </section>
            )}
            {step === 1 && (
              <div className="form-step">
                <div className="field-grid">
                  <label className="field full-field">
                    <span>{t.name}</span>
                    <input
                      value={form.customerName}
                      onChange={(event) =>
                        update("customerName", event.target.value)
                      }
                      placeholder={t.nameHint}
                      autoComplete="name"
                      dir="rtl"
                      maxLength={100}
                    />
                  </label>
                  <label className="field">
                    <span>{t.phone}</span>
                    <input
                      value={form.phone}
                      onChange={(event) => update("phone", event.target.value)}
                      placeholder="07XXXXXXXX"
                      autoComplete="tel"
                      inputMode="tel"
                      dir="ltr"
                      maxLength={16}
                    />
                  </label>
                  <label className="field">
                    <span>{t.requestType}</span>
                    <select
                      value={form.requestTypeId}
                      onChange={(event) =>
                        update("requestTypeId", event.target.value)
                      }
                      disabled={!requestTypes.length}
                    >
                      <option value="">
                        {requestTypes.length ? t.choose : t.noServices}
                      </option>
                      {requestTypes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {isArabic ? item.name_ar : item.name_en}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={form.whatsapp}
                    onChange={(event) =>
                      update("whatsapp", event.target.checked)
                    }
                  />
                  <span>
                    <b>{t.whatsapp}</b>
                    <small>WhatsApp</small>
                  </span>
                </label>
                <fieldset className="choice-fieldset">
                  <legend>{t.mode}</legend>
                  <div className="mode-grid">
                    {(config?.settings.homeServiceEnabled ?? true) && (
                      <button
                        type="button"
                        className={
                          form.serviceMode === "home" ? "selected" : ""
                        }
                        onClick={() => selectMode("home")}
                      >
                        <span className="choice-icon">⌂</span>
                        <b>{t.home}</b>
                        <small>
                          {isArabic ? "نصل إلى موقعك" : "We come to you"}
                        </small>
                      </button>
                    )}
                    {(config?.settings.shopServiceEnabled ?? true) && (
                      <button
                        type="button"
                        className={
                          form.serviceMode === "shop" ? "selected" : ""
                        }
                        onClick={() => selectMode("shop")}
                      >
                        <span className="choice-icon">▣</span>
                        <b>{t.shop}</b>
                        <small>
                          {isArabic
                            ? "تسليم القطعة للمعرض"
                            : "Bring the item in"}
                        </small>
                      </button>
                    )}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 2 && (
              <div className="form-step">
                <div className="field-grid">
                  <label className="field">
                    <span>{t.city}</span>
                    <input
                      value={form.city}
                      onChange={(event) => update("city", event.target.value)}
                      placeholder={t.cityHint}
                      maxLength={60}
                    />
                  </label>
                  <label className="field">
                    <span>{t.district}</span>
                    <input
                      value={form.district}
                      onChange={(event) =>
                        update("district", event.target.value)
                      }
                      placeholder={t.districtHint}
                      maxLength={80}
                    />
                  </label>
                  <label className="field full-field">
                    <span>{t.address}</span>
                    <input
                      value={form.addressLine}
                      onChange={(event) =>
                        update("addressLine", event.target.value)
                      }
                      placeholder={t.addressHint}
                      maxLength={180}
                    />
                  </label>
                  <label className="field full-field">
                    <span>{t.mapLink}</span>
                    <input
                      value={form.googleMapsUrl}
                      onChange={(event) =>
                        update("googleMapsUrl", event.target.value)
                      }
                      placeholder="https://maps.google.com/…"
                      dir="ltr"
                      maxLength={500}
                    />
                  </label>
                </div>
                <div className="location-actions">
                  <button
                    type="button"
                    className="location-primary"
                    onClick={useCurrentLocation}
                    disabled={locating}
                  >
                    {locating ? t.locating : `⌖ ${t.locate}`}
                  </button>
                  <a
                    href="https://www.google.com/maps"
                    target="_blank"
                    rel="noreferrer"
                  >
                    ↗ {t.map}
                  </a>
                </div>
                {form.latitude && form.longitude && (
                  <div className="location-confirmed">
                    ✓ {t.locationSaved}
                    <span dir="ltr">
                      {form.latitude}, {form.longitude}
                    </span>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="form-step">
                <label className="field date-field">
                  <span>{t.date}</span>
                  <input
                    type="date"
                    min={todayInJordan()}
                    value={form.bookingDate}
                    onChange={(event) => selectDate(event.target.value)}
                  />
                </label>
                <fieldset className="choice-fieldset time-fieldset">
                  <legend>{t.time}</legend>
                  {loadingSlots ? (
                    <div className="slot-loading">
                      <LoadingIndicator
                        compact
                        text={
                          isArabic
                            ? "نبحث عن المواعيد المتاحة…"
                            : "Checking available appointments…"
                        }
                      />
                    </div>
                  ) : (
                    <div className="slot-grid">
                      {slots.map((slot) => (
                        <button
                          key={slot.minute}
                          type="button"
                          className={
                            form.startMinute === String(slot.minute)
                              ? "selected"
                              : ""
                          }
                          onClick={() =>
                            update("startMinute", String(slot.minute))
                          }
                        >
                          <b>{isArabic ? slot.labelAr : slot.labelEn}</b>
                          <small>
                            {slot.availableTeams}{" "}
                            {isArabic ? "متاح" : "available"}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                  {form.bookingDate && !loadingSlots && slots.length === 0 && (
                    <p className="no-slots">{t.noSlots}</p>
                  )}
                </fieldset>
                <label className="field">
                  <span>{t.notes}</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    placeholder={t.notesHint}
                    maxLength={1000}
                    rows={5}
                  />
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="form-step summary-step">
                <div className="summary-heading">
                  <h2>{t.summary}</h2>
                  <p>{t.edit}</p>
                </div>
                <dl className="booking-summary">
                  <div>
                    <dt>{isArabic ? "المعرض" : "Showroom"}</dt>
                    <dd>{config?.showroom.name}</dd>
                  </div>
                  <div>
                    <dt>{t.name}</dt>
                    <dd>{form.customerName}</dd>
                  </div>
                  <div>
                    <dt>{t.phone}</dt>
                    <dd dir="ltr">{normalizedPhone(form.phone)}</dd>
                  </div>
                  <div>
                    <dt>{t.requestType}</dt>
                    <dd>
                      {selectedType
                        ? isArabic
                          ? selectedType.name_ar
                          : selectedType.name_en
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.mode}</dt>
                    <dd>{form.serviceMode === "home" ? t.home : t.shop}</dd>
                  </div>
                  <div>
                    <dt>
                      {t.city} / {t.district}
                    </dt>
                    <dd>
                      {form.serviceMode === "shop"
                        ? `${config?.showroom.city} — ${config?.showroom.address}`
                        : `${form.city} — ${form.district} — ${form.addressLine || form.googleMapsUrl || `${form.latitude}, ${form.longitude}`}`}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t.date} / {t.time}
                    </dt>
                    <dd>
                      {form.bookingDate} —{" "}
                      {selectedSlot
                        ? isArabic
                          ? selectedSlot.labelAr
                          : selectedSlot.labelEn
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="privacy-note">
                  <span>⌾</span>
                  <p>
                    {t.privacy}{" "}
                    <a href="/privacy" target="_blank" rel="noreferrer">
                      {isArabic ? "سياسة الخصوصية" : "Privacy notice"}
                    </a>
                  </p>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="success-state">
                <div className="success-mark">✓</div>
                <span>{config?.showroom.name}</span>
                <h1>{t.success}</h1>
                <p>{t.successText}</p>
                <div className="reference-card">
                  <small>{t.reference}</small>
                  <strong dir="ltr">{reference}</strong>
                </div>
                <dl className="booking-summary">
                  <div>
                    <dt>{isArabic ? "المعرض" : "Showroom"}</dt>
                    <dd>{config?.showroom.name}</dd>
                  </div>
                  <div>
                    <dt>{t.requestType}</dt>
                    <dd>
                      {isArabic ? selectedType?.name_ar : selectedType?.name_en}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {t.date} / {t.time}
                    </dt>
                    <dd>
                      {form.bookingDate} —{" "}
                      {selectedSlot
                        ? isArabic
                          ? selectedSlot.labelAr
                          : selectedSlot.labelEn
                        : form.startMinute}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.address}</dt>
                    <dd>
                      {form.serviceMode === "shop"
                        ? config?.showroom.address
                        : `${form.city} — ${form.district} — ${form.addressLine || form.googleMapsUrl || `${form.latitude}, ${form.longitude}`}`}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => {
                    setForm(initialForm);
                    setStep(0);
                    setShowroomId("");
                    setLoadingConfig(true);
                    setConfigError("");
                    setConfig(null);
                    setSlots([]);
                    setReference("");
                  }}
                >
                  {t.another}
                </button>
              </div>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {step > 0 && step < 5 && (
              <div className="form-actions">
                {step > 1 && (
                  <button
                    type="button"
                    className="back-button"
                    onClick={() => {
                      setStep((current) =>
                        current === 3 && form.serviceMode === "shop"
                          ? 1
                          : current - 1,
                      );
                      setError("");
                    }}
                  >
                    {t.back}
                  </button>
                )}
                {step < 4 ? (
                  <button
                    type="button"
                    className="next-button"
                    onClick={nextStep}
                    disabled={loadingConfig || !config}
                  >
                    {t.next}
                    <span>{isArabic ? "←" : "→"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="next-button"
                    onClick={submitBooking}
                    disabled={submitting}
                  >
                    {submitting
                      ? isArabic
                        ? "جارٍ تثبيت الحجز…"
                        : "Confirming booking…"
                      : t.submit}
                    <span>✓</span>
                  </button>
                )}
              </div>
            )}
          </form>
        </section>
      </section>

      <section id="how" className="how-strip">
        {[t.benefit1, t.benefit2, t.benefit3].map((benefit, index) => (
          <div key={benefit}>
            <b>0{index + 1}</b>
            <span>{benefit}</span>
          </div>
        ))}
      </section>
      <footer className="customer-footer">
        <a href="/" className="union-brand">
          <b>
            {isArabic ? "اتحاد الصيانة - اربد" : "Maintenance Union — Irbid"}
          </b>
        </a>
        <div>
          <span>
            {isArabic ? "حجز صيانة الأثاث" : "Furniture maintenance bookings"}
          </span>
          <small dir="ltr">© 2026 Eng. Mohammad Twait</small>
        </div>
      </footer>
    </main>
  );
}
