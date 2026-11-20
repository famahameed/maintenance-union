// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "../security-store";
import type { SessionUser } from "../auth";
import { todayInJordan } from "./types";

/** Action queues ignore list filters, but always retain the caller's tenant scope. */
export async function operationsData(user: SessionUser, showroomId: string) {
  if (user.role === "employee") return null;
  const db = getDatabase();
  const scope = showroomId ? " AND b.showroom_id=?" : "";
  const args = showroomId ? [showroomId] : [];
  const [summary, upcoming, events] = await Promise.all([
    db
      .prepare(
        `SELECT
      SUM(CASE WHEN b.status='confirmed' AND b.assigned_staff_id IS NULL THEN 1 ELSE 0 END) AS unassigned,
      SUM(CASE WHEN b.status='pending_admin_approval' THEN 1 ELSE 0 END) AS awaiting_approval,
      SUM(CASE WHEN b.booking_date < ? AND b.status IN ('confirmed','assigned','in_progress') THEN 1 ELSE 0 END) AS overdue,
      SUM(CASE WHEN b.status IN ('assigned','in_progress') AND (s.active=0 OR s.deleted_at IS NOT NULL) THEN 1 ELSE 0 END) AS needs_handover
      FROM union_private.bookings b LEFT JOIN union_private.staff s ON s.id=b.assigned_staff_id WHERE 1=1${scope}`,
      )
      .bind(todayInJordan(), ...args)
      .first(),
    db
      .prepare(
        `SELECT b.id,b.reference,b.booking_date,b.start_minute,b.status,r.name AS showroom_name,t.name_ar AS request_name_ar
      FROM union_private.bookings b JOIN union_private.showrooms r ON r.id=b.showroom_id JOIN union_private.request_types t ON t.id=b.request_type_id
      WHERE b.booking_date>=? AND b.status IN ('confirmed','assigned','in_progress')${scope}
      ORDER BY b.booking_date,b.start_minute LIMIT 8`,
      )
      .bind(todayInJordan(), ...args)
      .all(),
    user.role === "admin"
      ? db
          .prepare(
            `SELECT a.id,a.action,a.entity_type,a.entity_id,a.created_at,s.name AS actor_name
      FROM union_private.audit_log a LEFT JOIN union_private.staff s ON s.id=a.actor_id
      ORDER BY a.id DESC LIMIT 100`,
          )
          .all()
      : Promise.resolve({ results: [] }),
  ]);
  return { summary, upcoming: upcoming.results, events: events.results };
}
