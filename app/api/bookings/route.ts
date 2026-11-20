// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import {
  audit,
  enforceRateLimit,
  getDatabase,
  sha256Hex,
} from "../../../lib/security-store";
import { sameOrigin } from "../../../lib/auth";
import {
  cleanText,
  normalizeArabicName,
  normalizeJordanPhone,
  readJson,
  toInteger,
} from "../../../lib/validation";
import { ApiError, errorResponse } from "../../../lib/union/access";
import { publicShowroom, availableSlots } from "../../../lib/union/schedule";
import { assignAutomatically } from "../../../lib/union/bookings";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new ApiError(403, "مصدر الطلب غير صالح");
    const p = await readJson<Record<string, unknown>>(request);
    const name = normalizeArabicName(p.customerName),
      phone = normalizeJordanPhone(p.phone),
      typeId = toInteger(p.requestTypeId, 1, 1000000),
      start = toInteger(p.startMinute, 0, 1439);
    if (
      !name ||
      !phone ||
      !typeId ||
      start === null ||
      !["home", "shop"].includes(String(p.serviceMode))
    )
      throw new ApiError(400, "أكمل بيانات الحجز بشكل صحيح");
    const s = await publicShowroom(cleanText(p.showroomId, 80));
    const date = cleanText(p.bookingDate, 10),
      mode = String(p.serviceMode);
    let city = cleanText(p.city, 60),
      district = cleanText(p.district, 80),
      address = cleanText(p.addressLine, 180);
    const map = cleanText(p.googleMapsUrl, 500);
    if (
      map &&
      !/^https:\/\/(?:maps\.app\.goo\.gl|maps\.google\.com|www\.google\.com|goo\.gl)(?:\/|$)/i.test(
        map,
      )
    )
      throw new ApiError(400, "أدخل رابط خرائط Google صحيحًا");
    const coord = (v: unknown, min: number, max: number) =>
      v !== "" &&
      v != null &&
      Number.isFinite(Number(v)) &&
      Number(v) >= min &&
      Number(v) <= max
        ? Number(v).toFixed(6)
        : null;
    const lat = coord(p.latitude, -90, 90),
      lng = coord(p.longitude, -180, 180);
    if (
      mode === "home" &&
      (!city || !district || (!address && !(lat && lng) && !map))
    )
      throw new ApiError(400, "أكمل عنوان الصيانة المنزلية");
    if (mode === "shop") {
      city = s.city;
      district = "المعرض";
      address = s.address;
    }
    if (
      !(await enforceRateLimit(request, "booking-ip", "all", 30, 3600)) ||
      !(await enforceRateLimit(request, "booking", phone, 10, 3600, true))
    )
      throw new ApiError(429, "وصلت للحد المسموح، حاول لاحقًا");
    const db = getDatabase();
    const submissionKey =
      typeof p.requestId === "string" && /^[0-9a-f-]{36}$/i.test(p.requestId)
        ? p.requestId
        : null;
    const fingerprint = await sha256Hex(
      JSON.stringify([
        s.id,
        name,
        phone,
        typeId,
        mode,
        city,
        district,
        address,
        lat,
        lng,
        map,
        date,
        start,
        !!p.whatsapp,
        cleanText(p.notes, 1000),
      ]),
    );
    async function previousReceipt() {
      if (!submissionKey) return null;
      const old = await db
        .prepare(
          "SELECT b.reference,b.booking_date,b.start_minute,b.duration_minute,b.submission_fingerprint,s.name FROM union_private.bookings b JOIN union_private.showrooms s ON s.id=b.showroom_id WHERE b.submission_key=?",
        )
        .bind(submissionKey)
        .first<{
          reference: string;
          booking_date: string;
          start_minute: number;
          duration_minute: number;
          submission_fingerprint: string;
          name: string;
        }>();
      if (!old) return null;
      if (old.submission_fingerprint !== fingerprint)
        throw new ApiError(
          409,
          "تغيرت بيانات المحاولة؛ أعد إرسال الحجز من الصفحة",
        );
      return Response.json(
        {
          reference: old.reference,
          showroomName: old.name,
          bookingDate: old.booking_date,
          startMinute: old.start_minute,
          duration: old.duration_minute,
        },
        { status: 201 },
      );
    }
    const previous = await previousReceipt();
    if (previous) return previous;
    const service = await db
      .prepare(
        "SELECT id FROM union_private.request_types WHERE id = ? AND showroom_id = ? AND published = 1",
      )
      .bind(typeId, s.id)
      .first();
    if (!service) throw new ApiError(400, "الخدمة لا تتبع المعرض المختار");
    const times = await availableSlots(s, date, mode);
    if (!times.slots.some((t) => t.minute === start))
      throw new ApiError(409, "الموعد غير متاح، اختر موعدًا آخر");
    for (let team = 1; team <= s.teams_count; team++) {
      const id = crypto.randomUUID(),
        reference =
          "MU-" +
          crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
      try {
        await db
          .prepare(
            `INSERT INTO union_private.bookings (id,reference,showroom_id,customer_name,phone,whatsapp,request_type_id,service_mode,city,district,address_line,latitude,longitude,google_maps_url,booking_date,start_minute,duration_minute,slot_index,notes,submission_key,submission_fingerprint) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            id,
            reference,
            s.id,
            name,
            phone,
            p.whatsapp ? 1 : 0,
            typeId,
            mode,
            city,
            district,
            address,
            mode === "home" ? lat : null,
            mode === "home" ? lng : null,
            mode === "home" ? map : "",
            date,
            start,
            s.booking_duration_minute,
            team,
            cleanText(p.notes, 1000),
            submissionKey,
            fingerprint,
          )
          .run();
      } catch (e) {
        const receipt = await previousReceipt();
        if (receipt) return receipt;
        const message = e instanceof Error ? e.message : "";
        if (message.includes("daily limit"))
          throw new ApiError(409, "اكتمل العدد المسموح لهذا اليوم");
        if (message.includes("showroom schedule"))
          throw new ApiError(409, "تغيرت إعدادات المعرض، حدّث المواعيد");
        if (
          message.includes("time unavailable") ||
          (e instanceof Error && "code" in e && e.code === "23505")
        )
          continue;
        throw e;
      }
      // The booking is already committed. Auxiliary failures must not invite duplicate submissions.
      try {
        await audit(null, "booking_created", "booking", id, {
          showroomId: s.id,
          reference,
        });
      } catch (e) {
        console.error("Booking audit failed", e);
      }
      if (s.assignment_mode === "automatic")
        try {
          await assignAutomatically(id, s.id);
        } catch (e) {
          console.error("Automatic assignment deferred", e);
        }
      return Response.json(
        {
          reference,
          showroomName: s.name,
          bookingDate: date,
          startMinute: start,
          duration: s.booking_duration_minute,
        },
        { status: 201 },
      );
    }
    throw new ApiError(409, "حُجز الموعد للتو، اختر موعدًا آخر");
  } catch (e) {
    return errorResponse(e);
  }
}
