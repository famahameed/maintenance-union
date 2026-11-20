// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "../security-store";
import { SessionUser } from "../auth";
import { cleanText, isIsoDate, toInteger } from "../validation";
import { ApiError, requireShowroom } from "./access";
import { todayInJordan } from "./types";
import { operationsData } from "./operations";
import { mfaEnabled } from "./mfa";
export async function portalData(user: SessionUser, url: URL) {
  const db = getDatabase(),
    q = url.searchParams;
  if (q.get("scope") && q.get("scope") !== user.role)
    throw new ApiError(403, "استخدم البوابة المناسبة لحسابك");
  let showroomId = q.get("showroomId") || "";
  if (user.role !== "admin")
    showroomId = (await requireShowroom(user, showroomId)).id;
  const showrooms = await (
    user.role === "admin"
      ? db.prepare(
          "SELECT s.*,(SELECT string_agg(phone, '، ') FROM union_private.staff WHERE showroom_id=s.id AND role='manager' AND deleted_at IS NULL) AS manager_phones FROM union_private.showrooms s ORDER BY name",
        )
      : db
          .prepare("SELECT * FROM union_private.showrooms WHERE id = ?")
          .bind(showroomId)
  ).all();
  if (showroomId && user.role === "admin")
    await requireShowroom(user, showroomId);
  const where: string[] = [],
    args: unknown[] = [];
  if (showroomId) {
    where.push("b.showroom_id = ?");
    args.push(showroomId);
  }
  if (user.role === "employee") {
    where.push("b.assigned_staff_id = ?");
    args.push(user.id);
  }
  const date = q.get("date");
  if (date) {
    if (!isIsoDate(date)) throw new ApiError(400, "تاريخ غير صالح");
    where.push("b.booking_date = ?");
    args.push(date);
  }
  const status = cleanText(q.get("status"), 40);
  const queue = q.get("queue");
  if (queue === "unassigned")
    where.push("b.status='confirmed' AND b.assigned_staff_id IS NULL");
  if (queue === "overdue") {
    where.push(
      "b.booking_date < ? AND b.status IN ('confirmed','assigned','in_progress')",
    );
    args.push(todayInJordan());
  }
  if (queue === "handover")
    where.push(
      "b.status IN ('assigned','in_progress') AND EXISTS (SELECT 1 FROM union_private.staff h WHERE h.id=b.assigned_staff_id AND (h.active=0 OR h.deleted_at IS NOT NULL))",
    );
  if (status) {
    where.push("b.status = ?");
    args.push(status);
  }
  const employee = cleanText(q.get("employeeId"), 80);
  if (employee && user.role !== "employee") {
    where.push("b.assigned_staff_id = ?");
    args.push(employee);
  }
  const search = cleanText(q.get("q"), 100);
  if (search && !user.read_only) {
    where.push(
      "(b.customer_name LIKE ? OR b.phone LIKE ? OR b.reference LIKE ?)",
    );
    args.push(...Array(3).fill("%" + search + "%"));
  }
  const clause = where.length ? "WHERE " + where.join(" AND ") : "";
  const page = toInteger(q.get("page") || 1, 1, 100000) || 1;
  const [bookings, total, staff, services] = await Promise.all([
    db
      .prepare(
        `SELECT b.*,t.name_ar AS request_name_ar,t.name_en AS request_name_en,s.name AS showroom_name,e.name AS employee_name FROM union_private.bookings b JOIN union_private.request_types t ON t.id=b.request_type_id JOIN union_private.showrooms s ON s.id=b.showroom_id LEFT JOIN union_private.staff e ON e.id=b.assigned_staff_id ${clause} ORDER BY b.booking_date DESC,b.start_minute LIMIT 50 OFFSET ?`,
      )
      .bind(...args, (page - 1) * 50)
      .all(),
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM union_private.bookings b ${clause}`,
      )
      .bind(...args)
      .first<{ count: number }>(),
    user.role === "employee"
      ? Promise.resolve({ results: [] })
      : db
          .prepare(
            `SELECT id,name,phone,role,active,read_only,showroom_id,(SELECT COUNT(*) FROM union_private.sessions WHERE staff_id=staff.id AND auth_version=staff.auth_version AND expires_at>CURRENT_TIMESTAMP) AS session_count FROM union_private.staff WHERE role != 'admin' AND deleted_at IS NULL ${showroomId ? "AND showroom_id = ?" : ""} ORDER BY role,name`,
          )
          .bind(...(showroomId ? [showroomId] : []))
          .all(),
    user.role === "employee"
      ? Promise.resolve({ results: [] })
      : db
          .prepare(
            `SELECT * FROM union_private.request_types ${showroomId ? "WHERE showroom_id = ?" : ""} ORDER BY sort_order,id`,
          )
          .bind(...(showroomId ? [showroomId] : []))
          .all(),
  ]);
  const scope = showroomId ? "WHERE showroom_id = ?" : "";
  const counts =
    user.role === "employee"
      ? null
      : await db
          .prepare(
            `SELECT COUNT(*) AS total,SUM(CASE WHEN booking_date = ? AND status NOT IN ('cancelled','rejected') THEN 1 ELSE 0 END) AS today,SUM(CASE WHEN status='pending_admin_approval' THEN 1 ELSE 0 END) AS pending_approval,SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed FROM union_private.bookings ${scope}`,
          )
          .bind(todayInJordan(), ...(showroomId ? [showroomId] : []))
          .first();
  return {
    mfaEnabled: await mfaEnabled(user.id),
    mfaRequired: user.role === "admin" && process.env.APP_ENV === "production",
    operations: await operationsData(user, showroomId),
    user,
    sessionCount:
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS n FROM union_private.sessions WHERE staff_id=? AND auth_version=? AND expires_at>CURRENT_TIMESTAMP",
          )
          .bind(user.id, user.auth_version)
          .first<{ n: number }>()
      )?.n || 0,
    showrooms: showrooms.results.map((s) =>
      user.read_only ? { ...s, manager_phones: "مخفي في العرض التجريبي" } : s,
    ),
    selectedShowroomId: showroomId,
    staff: staff.results.map((s) =>
      user.read_only
        ? { ...s, name: "حساب للعرض", phone: "", session_count: 0 }
        : s,
    ),
    employees: staff.results
      .filter((s) => s.role === "employee")
      .map((s) =>
        user.read_only
          ? { ...s, name: "حساب للعرض", phone: "", session_count: 0 }
          : s,
      ),
    requestTypes: services.results,
    bookings: bookings.results.map((b) =>
      user.read_only
        ? {
            ...b,
            customer_name: "عميل — بيانات مخفية",
            phone: "",
            whatsapp: 0,
            address_line: "مخفي في العرض التجريبي",
            district: "",
            latitude: null,
            longitude: null,
            google_maps_url: "",
            notes: "",
            completion_note: "",
            employee_name: "موظف المعرض",
          }
        : b,
    ),
    counts,
    total: total?.count || 0,
    page,
    pageSize: 50,
    refreshedAt: new Date().toISOString(),
  };
}
