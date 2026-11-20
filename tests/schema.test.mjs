// Copyright © 2026 Eng. Mohammad Twait. All rights reserved. See NOTICE.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Fresh install: private schema, no demo users, restricted runtime and anonymous access", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(new URL("../sql/01-install.sql", import.meta.url), "utf8"),
    );
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM union_private.staff")).rows[0]
        .n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*) AS n FROM pg_tables WHERE schemaname='union_private' AND rowsecurity",
        )
      ).rows[0].n,
      8,
    );
    await db.exec("CREATE ROLE anonymous NOLOGIN; SET ROLE anonymous");
    await assert.rejects(
      db.query("SELECT * FROM union_private.bookings"),
      /permission denied/,
    );
    await db.exec("RESET ROLE; SET ROLE union_app");
    assert.equal(
      (await db.query("SELECT count(*) AS n FROM union_private.showrooms"))
        .rows[0].n,
      0,
    );
    await assert.rejects(
      db.exec("DELETE FROM union_private.audit_log"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("CREATE TABLE union_private.forbidden(id integer)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
