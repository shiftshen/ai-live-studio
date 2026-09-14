import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store.ts";
import { Worker } from "../src/server/worker.ts";
import { Secrets } from "../src/server/providers.ts";
test("one thousand rate-limited prints cannot hide another action lane", async () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-worker-lanes-"));
  const s = new Store(":memory:");
  const w = new Worker(s, new Secrets(dir), dir);
  try {
    s.setting("config", { ...s.setting("config"), printRate: 1 });
    s.put("attempts", { id: "recent", printerId: "limited", at: Date.now() });
    s.tx(() => {
      for (let i = 0; i < 1000; i++)
        s.put("jobs", {
          id: `limited-${i}`,
          action: "print",
          printerId: "limited",
          status: "pending",
          priority: 100,
          createdAt: i,
        });
      s.put("jobs", {
        id: "free-overlay",
        action: "overlay",
        status: "pending",
        priority: 50,
        createdAt: Date.now(),
        eventId: "free-event",
        content: "hello",
      });
    });
    await w.tick();
    assert.equal(s.get("jobs", "free-overlay").enriched, true);
    assert.equal(s.get("jobs", "limited-0").status, "pending");
    assert.equal(s.count("attempts"), 1, "limited printer must not dispatch");
  } finally {
    await w.stop();
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("accepted receipt polling does not starve ready overlay", async () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-worker-"));
  const s = new Store(":memory:");
  const w = new Worker(s, new Secrets(dir), dir);
  s.put("jobs", {
    id: "print",
    action: "print",
    status: "accepted",
    priority: 100,
    lastPoll: Date.now(),
    createdAt: 1,
  });
  s.put("jobs", {
    id: "overlay",
    action: "overlay",
    status: "pending",
    priority: 50,
    createdAt: Date.now(),
    eventId: "e",
    content: "hi",
  });
  await w.tick();
  assert.equal(s.get("jobs", "overlay").enriched, true);
  s.close();
  rmSync(dir, { recursive: true, force: true });
});

test("printer font channel is device-configured for every content language", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "studio-printer-font-"));
  const s = new Store(":memory:");
  const secrets = new Secrets(dir);
  const w = new Worker(s, secrets, dir);
  const sent: URLSearchParams[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, options: RequestInit) => {
      assert.ok(options.body instanceof URLSearchParams);
      sent.push(options.body);
      return new Response(JSON.stringify({ ret: 0, data: "mock-order" }));
    },
  );
  try {
    for (const renderLanguage of ["Thai", "default", undefined]) {
      const printerId = `font-${renderLanguage ?? "legacy"}`;
      s.put("printers", {
        id: printerId,
        enabled: true,
        imageSupported: false,
        ...(renderLanguage ? { renderLanguage } : {}),
      });
      secrets.set(printerId, {
        sn: "123456789",
        user: "test",
        ukey: "test",
        apiBase: "https://invalid.example/",
      });
      for (const language of ["zh", "th", "en"]) {
        const job = {
          id: `${printerId}-${language}`,
          printerId,
          language,
          action: "print",
          status: "pending",
          origin: "simulated",
          explicitTest: true,
          ruleId: "device-test",
          content: "中文 ภาษาไทย English",
          avatar: null,
          createdAt: Date.now(),
          ai: false,
          needsAvatar: false,
        };
        s.put("jobs", job);
        await w.process(job);
        assert.equal(s.get("jobs", job.id).status, "accepted");
        const form = sent.at(-1)!;
        assert.equal(
          form.get("language"),
          renderLanguage === "default" ? null : "Thai",
        );
        assert.equal(form.has("language"), renderLanguage !== "default");
        assert.equal(form.get("apiname"), "Open_printMsg");
        assert.equal(form.get("times"), "1");
        assert.ok(form.get("content")!.includes(job.content));
      }
    }
    assert.equal(sent.length, 9);
  } finally {
    await w.stop();
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stale ordinary screen and speech feedback expires without dropping gift or print work", async () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-expiry-"));
  const s = new Store(":memory:");
  const w = new Worker(s, new Secrets(dir), dir);
  try {
    const old = Date.now() - 180000;
    for (const type of ["follow", "comment", "like", "gift"]) {
      s.put("events", { id: type, type, receivedAt: old });
      for (const action of ["speech", "overlay", "print"]) {
        s.put("jobs", {
          id: `${type}-${action}`,
          eventId: type,
          action,
          status: action === "overlay" ? "pending" : "ready",
          enriched: true,
          createdAt: old,
        });
      }
    }
    await w.tick();
    for (const type of ["follow", "comment", "like"]) {
      assert.equal(s.get("jobs", `${type}-speech`).status, "expired");
      assert.equal(s.get("jobs", `${type}-overlay`).status, "expired");
      assert.equal(s.get("jobs", `${type}-print`).status, "ready");
    }
    assert.equal(s.get("jobs", "gift-speech").status, "ready");
    assert.equal(s.get("jobs", "gift-overlay").status, "pending");
  } finally {
    await w.stop();
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
