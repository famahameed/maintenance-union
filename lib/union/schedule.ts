// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { getDatabase } from "../security-store";
import {
  isFutureJordanDate,
  isIsoDate,
  jordanWeekday,
  minutesLabel,
} from "../validation";
import { ApiError } from "./access";
import { Showroom, todayInJordan } from "./types";
export function isPastTime(date: string, minute: number) {
  if (date !== todayInJordan()) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Amman",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .split(":")
    .map(Number);
  return minute <= parts[0] * 60 + parts[1];
}
export async function publicShowroom(id: string) {
  const row = await getDatabase()
    .prepare(
      "SELECT * FROM union_private.showrooms WHERE id = ? AND active = 1",
    )
    .bind(id)
    .first<Showroom>();
  if (!row) throw new ApiError(404, "المعرض غير متاح لاستقبال الحجوزات");
  return row;
}
export function validateDate(date: string) {
  if (!isIsoDate(date) || !isFutureJordanDate(date))
    throw new ApiError(400, "اختر تاريخًا صحيحًا غير سابق لليوم");
}
export async function availableSlots(
  showroom: Showroom,
  date: string,
  mode: string,
) {
  validateDate(date);
  if (!["home", "shop"].includes(mode))
    throw new ApiError(400, "مكان الصيانة غير صالح");
  if (
    !(JSON.parse(showroom.work_days) as number[]).includes(jordanWeekday(date))
  )
    return { date, slots: [], closed: true };
  if (
    !(mode === "home"
      ? showroom.home_service_enabled
      : showroom.shop_service_enabled)
  )
    return { date, slots: [], modeDisabled: true };
  const db = getDatabase();
  const bookings = await db
    .prepare(
      "SELECT start_minute,duration_minute,slot_index FROM union_private.bookings WHERE showroom_id = ? AND booking_date = ? AND status NOT IN ('cancelled','rejected')",
    )
    .bind(showroom.id, date)
    .all<{
      start_minute: number;
      duration_minute: number;
      slot_index: number;
    }>();
  if (bookings.results.length >= showroom.daily_booking_limit)
    return { date, slots: [], dailyLimitReached: true };
  const slots = [];
  for (
    let start = showroom.work_start_minute;
    start + showroom.booking_duration_minute <= showroom.work_end_minute;
    start += showroom.booking_duration_minute
  ) {
    if (isPastTime(date, start)) continue;
    let count = 0;
    for (let team = 1; team <= showroom.teams_count; team++)
      if (
        !bookings.results.some(
          (b) =>
            b.slot_index === team &&
            b.start_minute < start + showroom.booking_duration_minute &&
            b.start_minute + b.duration_minute > start,
        )
      )
        count++;
    count = Math.min(
      count,
      showroom.daily_booking_limit - bookings.results.length,
    );
    if (count)
      slots.push({
        minute: start,
        labelAr: minutesLabel(start, "ar"),
        labelEn: minutesLabel(start, "en"),
        availableTeams: count,
      });
  }
  return { date, duration: showroom.booking_duration_minute, slots };
}
