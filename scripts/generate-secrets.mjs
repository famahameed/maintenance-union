// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Create a local 0600 file; secrets are never written to stdout or the source tree. */
import { randomBytes, randomInt } from "node:crypto";
import { writeFile } from "node:fs/promises";
const groups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*_-",
];
let password = groups.map((g) => g[randomInt(g.length)]).join("");
const all = groups.join("");
while (password.length < 16) password += all[randomInt(all.length)];
const chars = [...password];
for (let i = chars.length - 1; i > 0; i--) {
  const j = randomInt(i + 1);
  [chars[i], chars[j]] = [chars[j], chars[i]];
}
const path = process.argv[2] || ".env.secrets";
await writeFile(
  path,
  `AUTH_SECRET=${randomBytes(48).toString("base64url")}\nADMIN_CLI_SECRET=${randomBytes(48).toString("base64url")}\nRUNTIME_DB_PASSWORD=${randomBytes(32).toString("base64url")}\nBOOTSTRAP_ADMIN_PASSWORD=${chars.join("")}\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Secret file created. Store it in a password manager and do not upload it to Git.",
);
