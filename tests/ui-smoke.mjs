// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
/** Browser checks for a LOCAL deployment. Uses test credentials only when explicitly supplied. */
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.UI_TEST_URL || "http://127.0.0.1:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("UI checks run only against a local test deployment.");
const args = process.env.UI_BROWSER_ARGS?.split(",").filter(Boolean) || [];
const browser = await chromium.launch({
  ...(process.env.UI_BROWSER_PATH
    ? { executablePath: process.env.UI_BROWSER_PATH }
    : {}),
  args,
});
const output = "tests/artifacts";
await mkdir(output, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const root = await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(root.status(), 200);
  await page.locator("h1").waitFor();
  assert.equal(
    await page
      .locator(
        'a[href="/admin"],a[href="/showroom"],a[href="/team"],a[href="/portals"]',
      )
      .count(),
    0,
  );
  await page.screenshot({
    path: output + "/customer-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: output + "/customer-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "Customer mobile layout overflows",
  );
  for (const path of ["/admin", "/showroom", "/team", "/portals"]) {
    const r = await page.goto(base + path, { waitUntil: "networkidle" });
    assert.equal(r.status(), 200);
    assert.ok(r.headers()["x-robots-tag"]?.includes("noindex"));
    if (path !== "/portals")
      await page.locator("input[type=password]").waitFor();
    else await page.locator("h1").waitFor();
    assert.ok((await page.locator("body").innerText()).length > 30);
    assert.equal(await page.locator('a[href="/admin"]').count(), 0);
    if (path !== "/portals") {
      await page.locator("input[type=password]").waitFor();
      assert.equal(
        await page.locator('a[href="/portals"],a[href="/"]').count(),
        0,
      );
    }
  }
  const response = await page.request.get(base + "/api/portal");
  assert.equal(response.status(), 401);
  if (process.env.UI_ADMIN_PHONE && process.env.UI_ADMIN_PASSWORD) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/admin");
    await page.locator("input[name=phone]").fill(process.env.UI_ADMIN_PHONE);
    await page
      .locator("input[name=password]")
      .fill(process.env.UI_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "دخول", exact: true }).click();
    await page.locator(".u-sidebar").waitFor();
    await page.getByRole("button", { name: "المعارض", exact: true }).click();
    await page
      .getByRole("button", { name: "فتح ملف المعرض", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "تعديل بيانات المعرض والشعار", exact: true })
      .click();
    await page.getByRole("heading", { name: /تعديل/ }).waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "إضافة معرض", exact: true })
        .count(),
      0,
    );
    if (process.env.UI_TEST_LOGO) {
      await page
        .locator("input[type=file]")
        .setInputFiles(process.env.UI_TEST_LOGO);
      await page
        .getByRole("button", { name: "حفظ بيانات المعرض", exact: true })
        .click();
      await page.getByRole("status").filter({ hasText: "تم حفظ" }).waitFor();
      const config = await (
        await page.request.get(base + "/api/config")
      ).json();
      assert.match(config.showrooms[0].logo_url, /^\/api\/logos\//);
      const image = await page.request.get(base + config.showrooms[0].logo_url);
      assert.equal(image.status(), 200);
      assert.equal(image.headers()["content-type"], "image/png");
    }
    await page.screenshot({
      path: output + "/admin-showroom-edit.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: output + "/admin-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      "Admin mobile layout overflows",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Browser smoke checks passed: customer routes, mobile layout, no private links, noindex headers, login portals and unauthenticated API access.",
  );
} finally {
  await browser.close();
}
