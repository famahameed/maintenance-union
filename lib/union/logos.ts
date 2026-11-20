// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { logoBucket } from "../logo-storage";
export { logoBucket } from "../logo-storage";
import { ApiError } from "./access";
import { PNG } from "pngjs";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
// Bound the stream, including multipart overhead, before buffering or parsing.
export async function readShowroomPayload(
  request: Request,
): Promise<Record<string, unknown>> {
  const limit = MAX_LOGO_BYTES + 24576;
  if (Number(request.headers.get("content-length")) > limit)
    throw new ApiError(413, "حجم الشعار الأقصى 2 ميجابايت");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "طلب فارغ");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ApiError(413, "حجم الشعار الأقصى 2 ميجابايت");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new ApiError(400, "ملف الرفع غير صالح");
  }
  const payload = form.get("payload");
  if (typeof payload !== "string" || payload.length > 24576)
    throw new ApiError(400, "بيانات غير صالحة");
  const data = JSON.parse(payload);
  if (!data || !["create_showroom", "update_showroom"].includes(data.action))
    throw new ApiError(400, "عملية رفع غير صالحة");
  return { ...data, logoFile: form.get("logoFile") };
}
export async function saveLogo(value: unknown): Promise<string | null> {
  if (value == null) return null;
  if (!(value instanceof File) || value.size === 0)
    throw new ApiError(400, "اختر صورة شعار صالحة");
  if (value.size > MAX_LOGO_BYTES)
    throw new ApiError(413, "حجم الشعار الأقصى 2 ميجابايت");
  const bytes = new Uint8Array(await value.arrayBuffer());
  // The browser converts accepted input formats to PNG. The server independently
  // decodes every pixel and re-encodes it, discarding metadata and appended data.
  if (
    bytes.length < 33 ||
    value.type !== "image/png" ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
  )
    throw new ApiError(
      400,
      "ارفع الشعار من زر اختيار الصورة ليتم تجهيزه بصيغة PNG",
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (!width || !height || width > 1024 || height > 1024)
    throw new ApiError(400, "أبعاد الشعار تتجاوز 1024 بكسل");
  let normalized: Uint8Array;
  try {
    if (bytes[28] !== 0)
      throw new Error("Interlaced input must be normalized by the upload form");
    const decoded = await new Promise<PNG>((resolve, reject) =>
      new PNG({ checkCRC: true }).parse(Buffer.from(bytes), (error, data) =>
        error ? reject(error) : resolve(data),
      ),
    );
    const clean = new PNG({ width: decoded.width, height: decoded.height });
    clean.data = decoded.data;
    clean.gamma = 0;
    normalized = PNG.sync.write(clean, { colorType: 6 });
  } catch {
    throw new ApiError(400, "تعذر قراءة الصورة؛ اختر صورة سليمة");
  }
  if (normalized.byteLength > MAX_LOGO_BYTES)
    throw new ApiError(413, "الصورة أكبر من الحد المسموح بعد المعالجة");
  const key = crypto.randomUUID();
  await logoBucket().put("showroom-logos/" + key, normalized);
  return "/api/logos/" + key;
}
export async function removeLogo(url: string) {
  if (/^\/api\/logos\/[0-9a-f-]{36}$/.test(url))
    await logoBucket().delete("showroom-logos/" + url.split("/").pop());
}
