// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
const values = new Map();

for (let index = 3; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument.startsWith("--")) continue;
  const [key, inlineValue] = argument.slice(2).split("=", 2);
  const nextValue = process.argv[index + 1];
  if (inlineValue !== undefined) {
    values.set(key, inlineValue);
  } else if (nextValue && !nextValue.startsWith("--")) {
    values.set(key, nextValue);
    index += 1;
  } else {
    values.set(key, "true");
  }
}

const action = process.argv[2];
const siteUrl = values.get("url") ?? process.env.APP_ORIGIN ?? "";
const secret = values.get("secret") ?? process.env.ADMIN_CLI_SECRET ?? "";
const phone = values.get("phone") ?? process.env.BOOTSTRAP_ADMIN_PHONE ?? "";
const password =
  values.get("password") ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
const name = values.get("name") ?? process.env.BOOTSTRAP_ADMIN_NAME ?? "";

if (!new Set(["create", "password"]).has(action))
  throw new Error("Use create or password.");
if (!siteUrl.startsWith("https://") && !siteUrl.startsWith("http://localhost"))
  throw new Error("APP_ORIGIN is invalid.");
if (secret.length < 32)
  throw new Error("ADMIN_CLI_SECRET must contain at least 32 characters.");
if (!/^07[789]\d{7}$/.test(phone))
  throw new Error("The Jordanian phone number is invalid.");
if (
  !(
    password.length === 16 &&
    /^[\x21-\x7e]+$/.test(password) &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
)
  throw new Error(
    "The password must be exactly 16 printable ASCII characters, with upper and lower case letters, a number, and a symbol.",
  );
if (action === "create" && name.trim().length < 3)
  throw new Error("The admin name is invalid.");

const endpoint = new URL("/api/server/admin", siteUrl);
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action, name, phone, password }),
});
const result = await response.json();
if (!response.ok)
  throw new Error(result.error ?? "The admin operation failed.");
console.log(
  action === "create" ? "Admin account created." : "Admin password updated.",
);
