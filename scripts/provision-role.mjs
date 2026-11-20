// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Run once using the DIRECT/session admin connection, never the runtime role. */
import { Client } from "pg";
const password = process.env.RUNTIME_DB_PASSWORD;
if (!password || password.length < 32)
  throw new Error(
    "Set a unique RUNTIME_DB_PASSWORD with at least 32 characters.",
  );
if (!process.env.ADMIN_DATABASE_URL)
  throw new Error("ADMIN_DATABASE_URL is required for provisioning only.");
const url = new URL(process.env.ADMIN_DATABASE_URL);
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
});
try {
  await db.connect();
  // PostgreSQL role DDL cannot bind a password. Ask PostgreSQL to quote the literal safely.
  const { rows } = await db.query("SELECT quote_literal($1) AS password", [
    password,
  ]);
  await db.query(`ALTER ROLE union_app LOGIN PASSWORD ${rows[0].password}`);
  console.log(
    "Runtime login configured. Remove ADMIN_DATABASE_URL and RUNTIME_DB_PASSWORD from deployment environments.",
  );
} finally {
  await db.end();
}
