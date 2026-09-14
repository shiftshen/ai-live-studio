import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { Store } from "../src/server/store.ts";
import { registerDevicesRoutes } from "../src/server/routes/devices.ts";
import type { RouteContext } from "../src/server/routes/context.ts";

test("printer API defaults to Thai and validates configurable font channels", async () => {
  const app = Fastify();
  const s = new Store(":memory:");
  registerDevicesRoutes({
    app,
    s,
    secrets: { set() {} },
    admin() {},
    requireRoom() {},
  } as unknown as RouteContext);
  try {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/printers",
      payload: {
        name: "Mock printer",
        sn: "123456789",
        user: "test",
        ukey: "test",
      },
    });
    assert.equal(created.statusCode, 200);
    assert.equal(created.json().renderLanguage, "Thai");
    assert.equal(created.json().imageSupported, false);
    const url = `/api/v1/printers/${created.json().id}`;
    for (const renderLanguage of ["default", "Thai"]) {
      const updated = await app.inject({
        method: "PATCH",
        url,
        payload: { renderLanguage },
      });
      assert.equal(updated.statusCode, 200);
      assert.equal(updated.json().renderLanguage, renderLanguage);
      assert.equal(
        s.get("printers", created.json().id).renderLanguage,
        renderLanguage,
      );
    }
    for (const renderLanguage of ["Chinese", "English", "th"]) {
      const invalid = await app.inject({
        method: "PATCH",
        url,
        payload: { renderLanguage },
      });
      assert.notEqual(invalid.statusCode, 200);
      assert.equal(s.get("printers", created.json().id).renderLanguage, "Thai");
    }
  } finally {
    await app.close();
    s.close();
  }
});

test("DAMO import requires an explicit exact serial and never selects another device", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { Secrets } = await import("../src/server/providers.ts");
  const dir = mkdtempSync(join(tmpdir(), "studio-import-test-"));
  try {
    const path = join(dir, "fixture.sqlite3");
    const db = new DatabaseSync(path);
    db.exec("CREATE TABLE pos_printers(sn TEXT,feie_user TEXT,feie_ukey TEXT)");
    db.prepare("INSERT INTO pos_printers VALUES(?,?,?)").run(
      "123456789",
      "test-user",
      "test-key",
    );
    db.close();
    const keys = new Secrets(join(dir, "secrets"));
    assert.throws(() => keys.importDamo("", path));
    assert.equal(keys.importDamo("987654321", path), false);
    assert.equal(keys.get("feie-test"), null);
    assert.equal(keys.importDamo("123456789", path), true);
    assert.equal(keys.get("feie-test")?.sn, "123456789");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
