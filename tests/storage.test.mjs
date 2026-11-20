// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { storageHeaders, logoBucket } from "../lib/logo-storage.ts";
import { saveLogo } from "../lib/union/logos.ts";

test("Secret API key is never sent as a JWT bearer token; legacy service-role JWT is supported", () => {
  assert.deepEqual(storageHeaders("sb_secret_test"), {
    apikey: "sb_secret_test",
  });
  assert.equal(
    storageHeaders("legacy.jwt.key").Authorization,
    "Bearer legacy.jwt.key",
  );
});
test("Server validates and re-encodes PNG, strips trailing content, and uploads a random private key", async () => {
  const original = globalThis.fetch;
  const calls = [];
  process.env.SUPABASE_URL = "https://local-storage.invalid";
  process.env.SUPABASE_STORAGE_SECRET = "sb_secret_test_only";
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("", { status: 200 });
  };
  try {
    const png = new PNG({ width: 2, height: 2 });
    png.data.fill(255);
    const bytes = PNG.sync.write(png);
    const encoded = Buffer.concat([
      bytes,
      Buffer.from("unwanted trailing metadata"),
    ]);
    const url = await saveLogo(
      new File([encoded], "logo.png", { type: "image/png" }),
    );
    assert.match(url, /^\/api\/logos\/[0-9a-f-]{36}$/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.equal(calls[0].options.headers["x-upsert"], "false");
    assert.ok(
      Buffer.from(calls[0].options.body).indexOf(
        Buffer.from("unwanted trailing metadata"),
      ) < 0,
    );
    await logoBucket().delete("showroom-logos/" + url.split("/").pop());
    assert.equal(calls[1].options.method, "DELETE");
    const broken = Buffer.from(bytes);
    broken[broken.length - 1] ^= 1;
    await assert.rejects(
      saveLogo(new File([broken], "bad.png", { type: "image/png" })),
      /صورة سليمة/,
    );
  } finally {
    globalThis.fetch = original;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_STORAGE_SECRET;
  }
});
