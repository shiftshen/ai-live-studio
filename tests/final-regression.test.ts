import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/server/app.ts";
import { Adapters } from "../src/server/adapters.ts";
import { Store } from "../src/server/store.ts";
import { Worker } from "../src/server/worker.ts";
import { Secrets } from "../src/server/providers.ts";

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "studio-final-regression-"));
  const x = await createApp({
    dir,
    workers: false,
    bootstrapToken: "test-only-token",
  });
  await x.app.ready();
  return {
    ...x,
    headers: { authorization: "Bearer test-only-token" },
    done: async () => {
      await x.app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("Dycast patch fields preserve streaks and filter shares without losing later valid batch entries", () => {
  const s = new Store(":memory:");
  try {
    const events: any[] = [];
    s.put("rooms", {
      id: "dy",
      platform: "douyin",
      sessionId: "s",
      capabilities: {},
    });
    const a = new Adapters(s, { ingest: (e: any) => events.push(e) } as any);
    a.relay("dy", [
      null,
      {
        method: "WebcastSocialMessage",
        id: "share",
        socialAction: "share",
        action: 3,
      },
      {
        method: "WebcastGiftMessage",
        id: "gift",
        user: { id: "u" },
        gift: { id: "g", type: 1, groupId: "streak", count: 7, repeatEnd: 1 },
      },
      { method: "WebcastSocialMessage", id: "follow1", socialAction: "follow" },
      { method: "WebcastSocialMessage", id: "follow2", action: "1" },
      { method: "WebcastChatMessage", id: "chat", content: "after null" },
    ]);
    assert.deepEqual(
      events.map((e) => e.sourceId),
      ["gift", "follow1", "follow2", "chat"],
    );
    assert.equal(events[0].streakId, "streak");
    assert.equal(events[0].streakable, true);
    assert.equal(events[0].repeatEnd, true);
    assert.equal(events[0].count, 7);
      } finally {
        s.close();
      }
    });

    test("Dycast relay accepts single-object payload and parses like totals", () => {
      const s = new Store(":memory:");
      try {
        const events: any[] = [];
        const room = s.list("rooms").find((r: any) => r.platform === "douyin")!;
        s.put("rooms", { ...room, status: "connected", sessionId: "s" });
        const a = new Adapters(s, { ingest: (e: any) => events.push(e) } as any);
        a.relay(room.id, {
          method: "WebcastLikeMessage",
          id: "single-like",
          room: { likeCount: 128 },
          user: { id: "u-liked" },
          timestamp: Date.now(),
          content: "给主播点赞了(128)",
        });
        assert.equal(events.length, 1);
        assert.equal(events[0].type, "like");
        assert.equal(events[0].count, 128);
        assert.equal(events[0].userId, "u-liked");
      } finally {
        s.close();
      }
    });

    test("Dycast relay supports alternate event keys for joins and follows", () => {
      const s = new Store(":memory:");
      try {
        const events: any[] = [];
        const room = s.list("rooms").find((r: any) => r.platform === "douyin")!;
        s.put("rooms", { ...room, status: "connected", sessionId: "s" });
        const a = new Adapters(s, { ingest: (e: any) => events.push(e) } as any);
        a.relay(room.id, [
          { eventType: "WebcastMemberMessage", msgId: "join-x", user: { id: "u1" } },
          { event_type: "WebcastSocialMessage", msg_id: "follow-x", eventType: "follow", user: { id: "u2" }, msgId: "follow-x" },
        ]);
        const types = events.map((e) => e.type).sort();
        assert.deepEqual(types, ["follow", "join"]);
        assert.equal(events.find((e) => e.sourceId === "follow-x")?.sourceId, "follow-x");
      } finally {
        s.close();
      }
    });

test("address changes disconnect and reset session capabilities; ordinary edits preserve session", async () => {
  const x = await fixture();
  try {
    const room = x.store.list("rooms")[0];
    room.address = room.platform === "douyin" ? "12345678" : "@original.room";
    room.language = "th";
    x.store.put("rooms", {
      ...room,
      status: "connected",
      capabilities: { comment: "observed", identity: "observed" },
    });
    const ordinary = await x.app.inject({
      method: "PATCH",
      url: `/api/v1/rooms/${room.id}`,
      headers: x.headers,
      payload: { name: "renamed" },
    });
    assert.equal(ordinary.statusCode, 200);
    assert.equal(ordinary.json().sessionId, room.sessionId);
    assert.equal(ordinary.json().address, room.address);
    assert.equal(ordinary.json().language, room.language);
    assert.equal(ordinary.json().status, "connected");
    const changed = await x.app.inject({
      method: "PATCH",
      url: `/api/v1/rooms/${room.id}`,
      headers: x.headers,
      payload: {
        address: room.platform === "douyin" ? "99887766" : "@regression.room",
      },
    });
    assert.equal(changed.statusCode, 200);
    assert.notEqual(changed.json().sessionId, room.sessionId);
    assert.equal(changed.json().status, "disconnected");
    assert.ok(
      Object.values(changed.json().capabilities).every(
        (v) => v === "unverified",
      ),
    );
    assert.equal(changed.json().capabilities.identity, undefined);
  } finally {
    await x.done();
  }
});

test("unknown live print requires explicit reason and fresh quota reservation for each reprint", async () => {
  const x = await fixture();
  try {
    const room = x.store.list("rooms")[0];
    x.store.put("jobs", {
      id: "uncertain-final",
      roomId: room.id,
      action: "print",
      origin: "live",
      status: "unknown",
      testPageReserved: true,
      providerId: "old-order",
    });
    const url = "/api/v1/jobs/uncertain-final/";
    assert.equal(
      (
        await x.app.inject({
          method: "POST",
          url: url + "retry",
          headers: x.headers,
        })
      ).statusCode,
      400,
    );
    for (const reason of ["", "ab", "   "]) {
      assert.equal(
        (
          await x.app.inject({
            method: "POST",
            url: url + "reprint",
            headers: x.headers,
            payload: { reason },
          })
        ).statusCode,
        400,
      );
    }
    assert.equal(
      (
        await x.app.inject({
          method: "POST",
          url: url + "reprint",
          headers: x.headers,
          payload: { reason: " receipt checked " },
        })
      ).statusCode,
      200,
    );
    const copy = x.store
      .list("jobs")
      .find((j: any) => j.parentId === "uncertain-final");
    assert.equal(copy.testPageReserved, false);
    assert.equal(copy.providerId, null);
    assert.equal(copy.reprintReason, "receipt checked");
    assert.equal(copy.status, "pending");
    assert.equal(x.store.get("jobs", "uncertain-final").status, "unknown");
  } finally {
    await x.done();
  }
});

test("shared quota counts reserved device tests and live prints once across concurrent lanes", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "studio-quota-regression-"));
  const s = new Store(":memory:");
  const secrets = new Secrets(dir);
  const w = new Worker(s, secrets, dir);
  let sends = 0;
  t.mock.method(globalThis, "fetch", async () => {
    sends++;
    await new Promise((resolve) => setTimeout(resolve, 2));
    return new Response(JSON.stringify({ ret: 0, data: "mock-" + sends }));
  });
  try {
    s.setting("config", {
      ...s.setting("config"),
      physicalTestMode: undefined,
    });
    s.setting("testPages", 3); // Three device tests reserved at API creation time.
    for (let i = 0; i < 16; i++) {
      const printerId = "quota-" + i;
      s.put("printers", { id: printerId, enabled: true });
      secrets.set(printerId, {
        sn: "123456789",
        user: "test",
        ukey: "test",
        apiBase: "https://invalid.example/",
      });
      s.put("jobs", {
        id: printerId,
        printerId,
        eventId: printerId,
        ruleId: i < 3 ? "device-test" : "live-rule",
        action: "print",
        origin: i < 3 ? "simulated" : "live",
        explicitTest: i < 3,
        testPageReserved: i < 3,
        status: "pending",
        content: "test",
        createdAt: Date.now(),
      });
    }
    await w.tick();
    assert.equal(sends, 10);
    assert.equal(s.setting("testPages"), 10);
    assert.equal(
      s.list("jobs").filter((j: any) => j.status === "blocked").length,
      6,
    );
    assert.equal(s.count("attempts"), 10);
    await w.tick();
    assert.equal(sends, 10, "blocked jobs must not auto resend");
  } finally {
    await w.stop();
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concurrent device tests reserve the same quota before dispatch and cannot exceed ten", async () => {
  const x = await fixture();
  try {
    const p = await x.app.inject({
      method: "POST",
      url: "/api/v1/printers",
      headers: x.headers,
      payload: { name: "mock", sn: "123456789", user: "test", ukey: "test" },
    });
    assert.equal(p.statusCode, 200);
    const responses = await Promise.all(
      Array.from({ length: 13 }, () =>
        x.app.inject({
          method: "POST",
          url: `/api/v1/printers/${p.json().id}/test`,
          headers: x.headers,
          payload: { text: "quota only; worker disabled" },
        }),
      ),
    );
    assert.equal(responses.filter((r) => r.statusCode === 200).length, 10);
    assert.equal(x.store.setting("testPages"), 10);
    assert.ok(
      x.store.list("jobs").every((j: any) => j.testPageReserved === true),
    );
    assert.equal(x.store.count("attempts"), 0);
  } finally {
    await x.done();
  }
});

test("reprint rejects unfinished jobs and admits only one concurrent copy into the last queue slot", async () => {
  const x = await fixture();
  try {
    const room = x.store.list("rooms")[0];
    const base = {
      roomId: room.id,
      printerId: "limited-printer",
      action: "print",
      origin: "live",
      testPageReserved: true,
    };
    for (const status of [
      "pending",
      "sending",
      "processing",
      "accepted",
      "held",
      "blocked",
      "ready",
    ]) {
      x.store.put("jobs", { ...base, id: "unfinished-" + status, status });
      const r = await x.app.inject({
        method: "POST",
        url: "/api/v1/jobs/unfinished-" + status + "/reprint",
        headers: x.headers,
        payload: { reason: "receipt checked" },
      });
      assert.equal(r.statusCode, 409, status);
      assert.equal(x.store.get("jobs", "unfinished-" + status).status, status);
    }
    assert.equal(x.store.list("jobs").filter((j: any) => j.parentId).length, 0);
    for (const j of x.store.list("jobs")) x.store.delete("jobs", j.id);
    x.store.setting("config", {
      ...x.store.setting("config"),
      printQueueLimit: 1,
    });
    x.store.put("jobs", {
      ...base,
      id: "finished-reprint",
      status: "completed",
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        x.app.inject({
          method: "POST",
          url: "/api/v1/jobs/finished-reprint/reprint",
          headers: x.headers,
          payload: { reason: "receipt checked" },
        }),
      ),
    );
    assert.equal(results.filter((r) => r.statusCode === 200).length, 1);
    assert.equal(results.filter((r) => r.statusCode === 409).length, 4);
    const copies = x.store
      .list("jobs")
      .filter((j: any) => j.parentId === "finished-reprint");
    assert.equal(copies.length, 1);
    assert.equal(copies[0].status, "pending");
    assert.equal(copies[0].testPageReserved, false);
    x.store.put("jobs", {
      ...base,
      printerId: "other-printer",
      id: "failed-reprint",
      status: "failed",
    });
    const other = await x.app.inject({
      method: "POST",
      url: "/api/v1/jobs/failed-reprint/reprint",
      headers: x.headers,
      payload: { reason: "receipt checked" },
    });
    assert.equal(
      other.statusCode,
      200,
      "a full printer must not block another printer",
    );
  } finally {
    await x.done();
  }
});

test("retry and reprint share active queue limits while held jobs can be released one at a time", async () => {
  const x = await fixture();
  try {
    const room = x.store.list("rooms")[0];
    x.store.setting("config", {
      ...x.store.setting("config"),
      printQueueLimit: 1,
    });
    const base = {
      roomId: room.id,
      printerId: "release-printer",
      action: "print",
      origin: "live",
    };
    const retry = (id: string) =>
      x.app.inject({
        method: "POST",
        url: `/api/v1/jobs/${id}/retry`,
        headers: x.headers,
      });
    for (const status of ["held", "blocked", "failed"])
      x.store.put("jobs", { ...base, id: "retry-" + status, status });
    for (const status of ["pending", "sending", "processing", "accepted"]) {
      x.store.put("jobs", { ...base, id: "occupant", status });
      for (const waiting of ["held", "blocked", "failed"]) {
        assert.equal(
          (await retry("retry-" + waiting)).statusCode,
          409,
          `${status} must block ${waiting}`,
        );
        assert.equal(x.store.get("jobs", "retry-" + waiting).status, waiting);
      }
    }
    x.store.put("jobs", { ...base, id: "occupant", status: "completed" });
    const results = await Promise.all(
      ["held", "blocked", "failed"].map((status) => retry("retry-" + status)),
    );
    assert.equal(results.filter((r) => r.statusCode === 200).length, 1);
    assert.equal(results.filter((r) => r.statusCode === 409).length, 2);
    const released = x.store
      .list("jobs")
      .find((j: any) => j.status === "pending");
    x.store.put("jobs", { ...released, status: "completed" });
    x.store.put("jobs", { ...base, id: "extra-held", status: "held" });
    assert.equal(
      (await retry("extra-held")).statusCode,
      200,
      "other held tasks do not consume executable capacity",
    );
    x.store.put("jobs", { ...base, id: "extra-held", status: "completed" });
    const reprint = await x.app.inject({
      method: "POST",
      url: "/api/v1/jobs/occupant/reprint",
      headers: x.headers,
      payload: { reason: "receipt checked" },
    });
    assert.equal(
      reprint.statusCode,
      200,
      "reprint uses the same held-excluding capacity calculation",
    );
  } finally {
    await x.done();
  }
});

test("relay transport without recent live events is not reported as a live room", () => {
  const s = new Store(":memory:");
  try {
    const room = s.list("rooms").find((r: any) => r.platform === "douyin");
    s.put("rooms", {
      ...room,
      status: "connected",
      lastEventAt: Date.now() - 120000,
    });
    const a = new Adapters(s, { ingest: () => {} } as any);
    a.refreshRelayHealth();
    assert.equal(s.get("rooms", room.id).status, "waiting_events");
    a.relay(room.id, [
      {
        method: "WebcastChatMessage",
        id: "historic",
        user: { id: "u" },
        content: "old",
        timestamp: Date.now() - 120000,
      },
    ]);
    assert.equal(s.get("rooms", room.id).status, "waiting_events");
    a.relay(room.id, [
      {
        method: "WebcastChatMessage",
        id: "fresh",
        user: { id: "u" },
        content: "new",
        timestamp: Date.now(),
      },
    ]);
    assert.equal(s.get("rooms", room.id).status, "connected");
  } finally {
    s.close();
  }
});
