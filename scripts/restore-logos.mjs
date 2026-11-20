// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Restore only validated logo files from this release's manifest into a staging bucket. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const dir = process.argv[2],
  origin = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_STORAGE_SECRET,
  bucket = process.env.SUPABASE_LOGO_BUCKET || "showroom-logos";
if (!dir || !origin || !key || process.env.APP_ENV !== "staging")
  throw new Error(
    "Supply a backup directory and staging-only Supabase credentials.",
  );
if (new URL(origin).protocol !== "https:")
  throw new Error("Storage requires HTTPS.");
const headers = key.startsWith("sb_secret_")
  ? { apikey: key }
  : { apikey: key, authorization: "Bearer " + key };
const endpoint = origin.replace(/\/$/, "") + "/storage/v1/";
const response = await fetch(
  endpoint + "bucket/" + encodeURIComponent(bucket),
  { headers, signal: AbortSignal.timeout(10000) },
);
if (!response.ok || (await response.json()).public !== false)
  throw new Error("The target bucket must exist and be private.");
const manifest = JSON.parse(
  await readFile(path.join(dir, "manifest.json"), "utf8"),
);
let count = 0;
for (const [name, hash] of Object.entries(manifest.files)) {
  if (!name.startsWith("logos/")) continue;
  if (!/^logos\/[0-9a-f-]{36}\.png$/.test(name))
    throw new Error("Invalid logo path in manifest");
  const bytes = await readFile(path.join(dir, name));
  if (
    bytes.length > 2097152 ||
    createHash("sha256").update(bytes).digest("hex") !== hash
  )
    throw new Error("Logo checksum/size mismatch");
  const id = path.basename(name, ".png");
  const r = await fetch(
    endpoint + "object/" + encodeURIComponent(bucket) + "/showroom-logos/" + id,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "image/png", "x-upsert": "true" },
      body: bytes,
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!r.ok) throw new Error("Logo restore failed");
  count++;
}
console.log(
  "Linked logos restored: " +
    count +
    ". Validate the deployed API before opening access.",
);
