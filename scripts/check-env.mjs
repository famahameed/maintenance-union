// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Fail closed on missing or misplaced production configuration. Does not print secrets. */
const errors = [];
for (const name of [
  "AUTH_SECRET",
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_STORAGE_SECRET",
  "APP_ORIGIN",
])
  if (!process.env[name]) errors.push(name + " is required");
if ((process.env.AUTH_SECRET || "").length < 32)
  errors.push("AUTH_SECRET must contain at least 32 random characters");
if (process.env.APP_ENV === "production") {
  if (!process.env.APP_ORIGIN?.startsWith("https://"))
    errors.push("APP_ORIGIN must use HTTPS");
  if (process.env.ADMIN_CLI_ENABLED === "true")
    errors.push("Disable ADMIN_CLI_ENABLED after bootstrap");
  if (process.env.DATABASE_TLS === "local-only")
    errors.push("Production must verify database TLS");
}
if (
  Object.keys(process.env).some(
    (n) =>
      n.startsWith("NEXT_PUBLIC_") && /SECRET|PASSWORD|DATABASE|TOKEN/i.test(n),
  )
)
  errors.push("A secret is assigned to a NEXT_PUBLIC_ variable");
try {
  if (new URL(process.env.DATABASE_URL).username.split(".")[0] !== "union_app")
    errors.push("DATABASE_URL must use the union_app runtime role");
} catch {
  errors.push("DATABASE_URL is invalid");
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  "Required environment settings are present. This does not prove network connectivity.",
);
