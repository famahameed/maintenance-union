// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Decode user-selected images locally; the API independently validates the PNG. */
export async function normalizeLogo(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 16000000
    )
      throw new Error("اختر صورة أصغر من 16 مليون بكسل");
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذر تجهيز الصورة في هذا المتصفح");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("تعذر تجهيز الصورة"))),
        "image/png",
      ),
    );
    if (blob.size > 2 * 1024 * 1024) throw new Error("اختر صورة أصغر");
    return new File([blob], "showroom-logo.png", { type: "image/png" });
  } finally {
    bitmap.close();
  }
}
