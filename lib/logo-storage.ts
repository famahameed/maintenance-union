// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Private Supabase Storage. Only the server possesses the secret API key. */
function config() {
  const origin = process.env.SUPABASE_URL,
    token = process.env.SUPABASE_STORAGE_SECRET;
  if (!origin || !token) throw new Error("Storage is not configured");
  const url = new URL(origin);
  if (url.protocol !== "https:") throw new Error("Storage requires HTTPS");
  return {
    origin: url.origin,
    token,
    bucket: process.env.SUPABASE_LOGO_BUCKET || "showroom-logos",
  };
}
export function storageHeaders(token: string): Record<string, string> {
  // New sb_secret keys are opaque API keys, not JWT bearer tokens.
  return token.startsWith("sb_secret_")
    ? { apikey: token }
    : { apikey: token, Authorization: `Bearer ${token}` };
}
function address(key: string) {
  const c = config();
  return {
    ...c,
    url: `${c.origin}/storage/v1/object/${encodeURIComponent(c.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`,
  };
}
export function logoBucket() {
  return {
    async put(key: string, bytes: Uint8Array) {
      const c = address(key);
      const r = await fetch(c.url, {
        method: "POST",
        headers: {
          ...storageHeaders(c.token),
          "Content-Type": "image/png",
          "x-upsert": "false",
        },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("Logo storage write failed");
    },
    async get(key: string) {
      const c = address(key);
      const r = await fetch(c.url, {
        headers: storageHeaders(c.token),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Logo storage read failed");
      return { body: r.body, httpMetadata: { contentType: "image/png" } };
    },
    async delete(key: string) {
      const c = config();
      const r = await fetch(
        `${c.origin}/storage/v1/object/${encodeURIComponent(c.bucket)}`,
        {
          method: "DELETE",
          headers: {
            ...storageHeaders(c.token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prefixes: [key] }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!r.ok) throw new Error("Logo storage delete failed");
    },
  };
}
