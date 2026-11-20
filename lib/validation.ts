// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
export function cleanText(value: unknown, maxLength = 300): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeArabicName(value: unknown): string | null {
  const name = cleanText(value, 100).replace(/ـ/g, "");
  const parts = name.split(" ").filter(Boolean);
  if (parts.length !== 3) return null;
  const arabicPart =
    /^[\p{Script=Arabic}ء-ي][\p{Script=Arabic}\p{M}ء-ي'-]{1,29}$/u;
  return parts.every((part) => arabicPart.test(part)) ? parts.join(" ") : null;
}

export function normalizeJordanPhone(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let phone = String(value).replace(/[^\d+]/g, "");
  if (phone.startsWith("+962")) phone = `0${phone.slice(4)}`;
  if (phone.startsWith("00962")) phone = `0${phone.slice(5)}`;
  if (phone.startsWith("962")) phone = `0${phone.slice(3)}`;
  return /^07[789]\d{7}$/.test(phone) ? phone : null;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00+03:00`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function jordanWeekday(date: string): number {
  return new Date(`${date}T12:00:00+03:00`).getUTCDay();
}

export function isFutureJordanDate(date: string): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return date >= today;
}

export function toInteger(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? number
    : null;
}

export function parseWorkDays(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const days = [...new Set(value.map(Number))].filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );
  return days.length ? days.sort((a, b) => a - b) : null;
}

export async function readJson<T extends Record<string, unknown>>(
  request: Request,
  maxBytes = 16_384,
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new Error("invalid content type");
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("request too large");
  if (!request.body) throw new SyntaxError("empty request body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("request too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  ) as T;
}

export function minutesLabel(
  value: number,
  language: "ar" | "en" = "ar",
): string {
  const hour24 = Math.floor(value / 60);
  const minute = value % 60;
  if (language === "en") {
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour = hour24 % 12 || 12;
    return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
  }
  const suffix = hour24 >= 12 ? "م" : "ص";
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}
