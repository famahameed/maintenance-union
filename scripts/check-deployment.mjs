// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Read-only production checks; does not print credentials or customer data. */
import { Client } from "pg";
import "./check-env.mjs";
const url = new URL(process.env.DATABASE_URL);
for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
  url.searchParams.delete(key);
const db = new Client({
  connectionString: url.toString(),
  ssl: {
    rejectUnauthorized: true,
    ...(process.env.DATABASE_CA_PEM
      ? { ca: process.env.DATABASE_CA_PEM.replace(/\\n/g, "\n") }
      : {}),
  },
  connectionTimeoutMillis: 10000,
});
try {
  await db.connect();
  const { rows } = await db.query(
    `SELECT current_user AS role,(SELECT count(*) FROM pg_tables WHERE schemaname='union_private' AND rowsecurity) AS protected_tables,(SELECT count(*) FROM union_private.staff s JOIN union_private.account_mfa m ON m.staff_id=s.id WHERE s.role='admin' AND s.active=1 AND s.deleted_at IS NULL AND m.enabled=1) AS protected_owner`,
  );
  if (
    rows[0].role !== "union_app" ||
    Number(rows[0].protected_tables) !== 8 ||
    Number(rows[0].protected_owner) !== 1
  )
    throw new Error(
      "Check runtime role, all RLS tables and owner two-factor authentication.",
    );
  const secret = process.env.SUPABASE_STORAGE_SECRET;
  const response = await fetch(
    new URL(
      "/storage/v1/bucket/" +
        encodeURIComponent(
          process.env.SUPABASE_LOGO_BUCKET || "showroom-logos",
        ),
      process.env.SUPABASE_URL,
    ),
    {
      headers: secret.startsWith("sb_secret_")
        ? { apikey: secret }
        : { authorization: "Bearer " + secret, apikey: secret },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new Error(
      "Storage bucket is unreachable with the supplied server credential.",
    );
  const bucket = await response.json();
  if (
    bucket.public !== false ||
    bucket.file_size_limit !== 2097152 ||
    !bucket.allowed_mime_types?.includes("image/png")
  )
    throw new Error("Storage must be private, PNG-only and limited to 2 MiB.");
  console.log(
    "Database TLS, runtime role, table RLS, owner MFA and private storage configuration passed.",
  );
} finally {
  await db.end();
}
