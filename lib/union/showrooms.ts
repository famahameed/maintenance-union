// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { hashPassword } from "../auth";
import { confirmedPassword, verifyActorPassword } from "./account-security";
import { saveLogo, removeLogo } from "./logos";
import { getDatabase } from "../security-store";
import {
  cleanText,
  normalizeJordanPhone,
  parseWorkDays,
  toInteger,
} from "../validation";
import { ApiError, requireAdmin, requireShowroom } from "./access";
import type { SessionUser } from "../auth";
function logo(value: unknown, previous = "") {
  const url = cleanText(value, 500);
  if (
    url &&
    url !== previous &&
    !(url.startsWith("/assets/") && !url.includes(".."))
  )
    throw new ApiError(400, "استخدم زر رفع الشعار من الجهاز");
  return url;
}
export async function showroomAction(
  user: SessionUser,
  p: Record<string, unknown>,
) {
  const db = getDatabase(),
    action = String(p.action);
  if (action === "toggle_showroom") {
    requireAdmin(user);
    const room = await requireShowroom(user, p.showroomId);
    if (typeof p.active !== "boolean")
      throw new ApiError(400, "حالة المعرض غير صالحة");
    await db
      .prepare(
        "UPDATE union_private.showrooms SET active = ?,updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .bind(p.active ? 1 : 0, room.id)
      .run();
    return { ok: true };
  }
  if (action === "create_showroom" || action === "update_showroom") {
    requireAdmin(user);
    const creating = action === "create_showroom";
    const previous = creating
      ? null
      : await requireShowroom(user, p.showroomId);
    const name = cleanText(p.name, 100),
      city = cleanText(p.city, 60),
      address = cleanText(p.address, 180);
    const phone = p.phone ? normalizeJordanPhone(p.phone) : "";
    if (
      name.length < 3 ||
      !city ||
      !address ||
      phone === null ||
      (creating && !phone)
    )
      throw new ApiError(
        400,
        "أكمل اسم المعرض والمدينة والعنوان ورقم التواصل الصحيح",
      );
    const loginPhone = normalizeJordanPhone(p.loginPhone);
    const password = creating ? confirmedPassword(p) : "";
    if (creating && (!loginPhone || loginPhone === phone))
      throw new ApiError(400, "رقم الدخول مطلوب ويجب أن يختلف عن رقم التواصل");
    const currentLogo = logo(p.logoUrl, previous?.logo_url);
    if (
      creating &&
      (await db
        .prepare("SELECT id FROM union_private.staff WHERE phone = ?")
        .bind(loginPhone)
        .first())
    )
      throw new ApiError(409, "رقم الدخول مسجل مسبقًا");
    if (creating) await verifyActorPassword(user, p.actorPassword);
    const hash = creating ? await hashPassword(password) : null;
    const id = previous?.id || crypto.randomUUID();
    const uploaded = await saveLogo(p.logoFile);
    const logoUrl = uploaded || currentLogo;
    try {
      if (creating) {
        // The PostgreSQL transaction is atomic: neither the showroom nor its owner is created alone.
        await db.batch([
          db
            .prepare(
              "INSERT INTO union_private.showrooms (id,name,name_en,logo_url,phone,city,address) VALUES (?,?,?,?,?,?,?)",
            )
            .bind(
              id,
              name,
              cleanText(p.nameEn, 100),
              logoUrl,
              phone,
              city,
              address,
            ),
          db
            .prepare(
              "INSERT INTO union_private.staff (id,name,phone,password_hash,password_salt,role,showroom_id) VALUES (?,?,?,?,?,'manager',?)",
            )
            .bind(
              crypto.randomUUID(),
              "صاحب " + name,
              loginPhone,
              hash!.hash,
              hash!.salt,
              id,
            ),
        ]);
      } else {
        // Editing identity must not overwrite a concurrent activation change.
        await db
          .prepare(
            "UPDATE union_private.showrooms SET name=?,name_en=?,logo_url=?,phone=?,city=?,address=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .bind(
            name,
            cleanText(p.nameEn, 100),
            logoUrl,
            phone,
            city,
            address,
            id,
          )
          .run();
      }
    } catch (e) {
      if (uploaded)
        await removeLogo(uploaded).catch((err) =>
          console.error("Logo cleanup failed", err),
        );
      if (e instanceof Error && "code" in e && e.code === "23505")
        throw new ApiError(409, "رقم الدخول مسجل مسبقًا");
      throw e;
    }
    if (previous?.logo_url && previous.logo_url !== logoUrl)
      await removeLogo(previous.logo_url).catch((err) =>
        console.error("Old logo cleanup failed", err),
      );
    return { ok: true, id };
  }
  if (user.role === "employee")
    throw new ApiError(403, "هذه العملية متاحة لصاحب المعرض والإدارة");
  const s = await requireShowroom(user, p.showroomId);
  if (action === "save_settings") {
    const start = toInteger(p.workStartMinute, 0, 1410),
      end = toInteger(p.workEndMinute, 30, 1440),
      duration = toInteger(p.bookingDurationMinute, 30, 240),
      teams = toInteger(p.teamsCount, 1, 20),
      daily = toInteger(p.dailyBookingLimit, 1, 200),
      employee = toInteger(p.employeeDailyLimit, 1, 20),
      days = parseWorkDays(p.workDays);
    if (
      start === null ||
      end === null ||
      duration === null ||
      teams === null ||
      daily === null ||
      employee === null ||
      !days ||
      start % 30 ||
      end % 30 ||
      duration % 30 ||
      end - start < duration ||
      (!p.homeServiceEnabled && !p.shopServiceEnabled)
    )
      throw new ApiError(400, "تحقق من الساعات والمدة والسعة وأيام العمل");
    const reserved = await db
      .prepare(
        "SELECT MAX(slot_index) AS highest FROM union_private.bookings WHERE showroom_id = ? AND booking_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Amman')::date::text AND status NOT IN ('cancelled','rejected')",
      )
      .bind(s.id)
      .first<{ highest: number | null }>();
    if (reserved?.highest && teams < reserved.highest)
      throw new ApiError(
        409,
        "لا يمكن تقليل عدد الفرق مع وجود حجوزات مستقبلية عليها",
      );
    await db
      .prepare(
        "UPDATE union_private.showrooms SET work_start_minute = ?,work_end_minute = ?,booking_duration_minute = ?,teams_count = ?,daily_booking_limit = ?,employee_daily_limit = ?,home_service_enabled = ?,shop_service_enabled = ?,work_days = ?,assignment_mode = ?,updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .bind(
        start,
        end,
        duration,
        teams,
        daily,
        employee,
        p.homeServiceEnabled ? 1 : 0,
        p.shopServiceEnabled ? 1 : 0,
        JSON.stringify(days),
        p.assignmentMode === "automatic" ? "automatic" : "manual",
        s.id,
      )
      .run();
    return { ok: true };
  }
  throw new ApiError(400, "إجراء غير معروف");
}
