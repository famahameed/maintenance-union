// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Owner-operated backup. PostgreSQL tools required; no secrets are written to the bundle. */
import { Client } from "pg";
import { spawn } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
const raw = process.env.ADMIN_DATABASE_URL;
if (!raw)
  throw new Error(
    "Supply ADMIN_DATABASE_URL using the Direct/session admin connection, for backup only.",
  );
const url = new URL(raw);
for (const k of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
  url.searchParams.delete(k);
const ca = process.env.DATABASE_CA_PEM?.replace(/\\n/g, "\n");
const dir = path.resolve(
  "backups",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(path.join(dir, "logos"), { recursive: true, mode: 0o700 });
const dump = path.join(dir, "database.dump");
await writeFile(dump, "", { flag: "wx", mode: 0o600 });
const caFile = path.join(dir, "provider-ca.pem");
if (ca) await writeFile(caFile, ca, { flag: "wx", mode: 0o600 });
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1) || "postgres",
  PGSSLMODE: "verify-full",
  ...(ca ? { PGSSLROOTCERT: caFile } : {}),
};
// Passwords go through the child's environment, not command-line arguments.
await new Promise((resolve, reject) => {
  const p = spawn(
    "pg_dump",
    [
      "--format=custom",
      "--schema=union_private",
      "--no-owner",
      "--no-privileges",
      "--file=" + dump,
    ],
    { env, stdio: ["ignore", "ignore", "ignore"] },
  );
  p.on("error", () =>
    reject(
      new Error(
        "pg_dump is unavailable; install PostgreSQL client tools matching the server major version.",
      ),
    ),
  );
  p.on("exit", (code) =>
    code === 0
      ? resolve()
      : reject(
          new Error(
            "Database export failed; verify Direct/session credentials, TLS and pg_dump version.",
          ),
        ),
  );
});
const db = new Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
});
const files = ["database.dump"];
try {
  await db.connect();
  const { rows } = await db.query(
    "SELECT DISTINCT logo_url FROM union_private.showrooms WHERE logo_url LIKE '/api/logos/%'",
  );
  const origin = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_STORAGE_SECRET,
    bucket = process.env.SUPABASE_LOGO_BUCKET || "showroom-logos";
  if (rows.length && (!origin || !key))
    throw new Error(
      "Logo storage credentials are required for a complete backup.",
    );
  for (const row of rows) {
    const id = row.logo_url.split("/").pop();
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new Error("Invalid linked logo identifier");
    const r = await fetch(
      new URL(
        "/storage/v1/object/" +
          encodeURIComponent(bucket) +
          "/showroom-logos/" +
          id,
        origin,
      ),
      {
        headers: key.startsWith("sb_secret_")
          ? { apikey: key }
          : { apikey: key, authorization: "Bearer " + key },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!r.ok)
      throw new Error(
        "A linked logo could not be exported. The backup is incomplete.",
      );
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > 2097152)
      throw new Error("Logo exceeds the expected size limit");
    const name = "logos/" + id + ".png";
    await writeFile(path.join(dir, name), bytes, { flag: "wx", mode: 0o600 });
    files.push(name);
  }
  const checksums = {};
  for (const name of files) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path.join(dir, name)))
      hash.update(chunk);
    checksums[name] = hash.digest("hex");
  }
  await writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        owner: "Eng. Mohammad Twait",
        createdAt: new Date().toISOString(),
        schema: "union_private",
        files: checksums,
      },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  console.log(
    "Backup complete. Encrypt and verify the folder before copying it off-site.",
  );
  // A separate encrypted AUTH_SECRET copy is mandatory for password/MFA recovery.
} finally {
  await db.end();
  if (ca) await unlink(caFile).catch(() => {});
}
