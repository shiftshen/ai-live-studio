import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/server/app.ts";
import { Store } from "../src/server/store.ts";
import { Worker } from "../src/server/worker.ts";
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "studio-data-"));
  const x = await createApp({ dir, workers: false, bootstrapToken: "test" });
  return {
    ...x,
    headers: { authorization: "Bearer test" },
    done: async () => {
      await x.app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
test("room filtering precedes limits and aggregate/export read full history", async () => {
  const x = await fixture();
  try {
    const [a, b] = x.store.list("rooms");
    x.store.tx(() => {
      for (let i = 0; i < 620; i++)
        x.store.put("events", {
          id: "a" + i,
          roomId: a.id,
          platform: "tiktok",
          userId: "fan",
          nickname: "Fan",
          origin: "live",
          identityReliable: true,
          type: "gift",
          count: 2,
          status: "matched",
          receivedAt: i,
        });
      for (let i = 0; i < 650; i++)
        x.store.put("events", {
          id: "b" + i,
          roomId: b.id,
          origin: "live",
          identityReliable: true,
          type: "gift",
          count: 9,
          status: "matched",
          receivedAt: 1000 + i,
        });
    });
    const access = await x.app.inject({
      method: "POST",
      url: "/api/v1/access",
      headers: x.headers,
      payload: { role: "viewer", roomIds: [a.id] },
    });
    const headers = { authorization: "Bearer " + access.json().token };
    const state = (
      await x.app.inject({ url: "/api/v1/state", headers })
    ).json();
    assert.equal(state.events.length, 300);
    assert.equal(state.stats.events, 620);
    assert.equal(state.stats.gifts, 1240);
    const csv = await x.app.inject({
      url: "/api/v1/export?kind=events",
      headers,
    });
    assert.equal(csv.body.trim().split("\n").length, 621);
    const fans = (
      await x.app.inject({ url: "/api/v1/fans?limit=10", headers })
    ).json();
    assert.equal(fans.total, 1);
    assert.equal(fans.items[0].giftCount, 1240);
    assert.equal(fans.items[0].eventCount, 620);
    const page = (
      await x.app.inject({ url: "/api/v1/events?limit=10&offset=610", headers })
    ).json();
    assert.equal(page.total, 620);
    assert.equal(page.items.length, 10);
  } finally {
    await x.done();
  }
});
test("fan gift totals include unmatched live gifts but exclude replay and anonymous identities", async () => {
  const x = await fixture();
  try {
    const room = x.store.list("rooms")[0];
    for (const rule of x.store.list("rules"))
      x.store.put("rules", { ...rule, enabled: false });
    const base = {
      roomId: room.id,
      sessionId: room.sessionId,
      platform: room.platform,
      sourceId: "unmatched-live",
      userId: "real-fan",
      nickname: "Real Fan",
      type: "gift",
      origin: "live",
      count: 9,
      occurredAt: Date.now(),
    };
    const live = x.engine.ingest(base);
    assert.equal(live.event.status, "unmatched");
    x.engine.ingest({
      ...base,
      sourceId: "replay",
      origin: "replay",
      count: 50,
    });
    x.engine.ingest({
      ...base,
      sourceId: "simulated",
      origin: "simulated",
      count: 60,
    });
    x.engine.ingest({
      ...base,
      sourceId: "anonymous",
      userId: "unverified-user",
      identityReliable: false,
      count: 70,
    });
    const fans = (
      await x.app.inject({
        url: `/api/v1/fans?roomId=${room.id}`,
        headers: x.headers,
      })
    ).json();
    assert.equal(fans.total, 1);
    assert.equal(fans.items[0].userId, "real-fan");
    assert.equal(fans.items[0].giftCount, 9);
    const state = (
      await x.app.inject({ url: "/api/v1/state", headers: x.headers })
    ).json();
    assert.equal(state.stats.gifts, 9);
    const csv = await x.app.inject({
      url: `/api/v1/export?kind=fans&roomId=${room.id}`,
      headers: x.headers,
    });
    assert.equal(csv.body.trim().split("\n").length, 2);
    assert.ok(!csv.body.includes("unverified-user"));
  } finally {
    await x.done();
  }
});

test("restore quarantines all old physical work and preserves test allowance", async () => {
  const x = await fixture();
  try {
    const room = x.store.list("rooms")[0];
    for (const status of [
      "pending",
      "sending",
      "accepted",
      "held",
      "blocked",
      "unknown",
      "ready",
    ])
      x.store.put("jobs", {
        id: status,
        roomId: room.id,
        action: "print",
        status,
        origin: "live",
      });
    x.store.setting("testPages", 2);
    const backup = (
      await x.app.inject({
        method: "POST",
        url: "/api/v1/backup",
        headers: x.headers,
      })
    ).json();
    x.store.setting("testPages", 8);
    x.store.setting("config", { ...x.store.setting("config"), paused: true });
    const r = await x.app.inject({
      method: "POST",
      url: "/api/v1/restore",
      headers: x.headers,
      payload: { name: backup.name },
    });
    assert.equal(r.statusCode, 200);
    const restored = new Store(join(x.dir, "restore-pending.sqlite3"));
    try {
      assert.equal(restored.setting("config").paused, true);
      assert.equal(restored.setting("testPages"), 8);
      assert.ok(restored.list("jobs").every((j) => j.status === "unknown"));
      assert.equal(restored.count("sessions"), 0);
      const worker = new Worker(restored, x.secrets, join(x.dir, "media"));
      let sends = 0;
      worker.process = async () => {
        sends++;
      };
      await worker.tick();
      assert.equal(sends, 0);
      restored.setting("config", {
        ...restored.setting("config"),
        paused: false,
      });
      await worker.tick();
      assert.equal(
        sends,
        0,
        "even explicitly unpausing must not auto-send restored physical work",
      );
    } finally {
      restored.close();
    }
  } finally {
    await x.done();
  }
});

test("media lookup cannot use another room preview ownership to bypass access", async () => {
  const x = await fixture();
  try {
    const [a, b] = x.store.list("rooms");
    const name = "a".repeat(64) + ".wav";
    x.store.setting("media:" + name, b.id);
    x.store.put("jobs", {
      id: "foreign-media",
      roomId: b.id,
      mediaUrl: "/api/v1/media/" + name,
    });
    const access = await x.app.inject({
      method: "POST",
      url: "/api/v1/access",
      headers: x.headers,
      payload: { role: "viewer", roomIds: [a.id] },
    });
    const r = await x.app.inject({
      url: "/api/v1/media/" + name,
      headers: { authorization: "Bearer " + access.json().token },
    });
    assert.equal(r.statusCode, 403);
  } finally {
    await x.done();
  }
});
test("logout invalidates existing session and successful mutations leave receipts", async () => {
  const x = await fixture();
  try {
    const login = await x.app.inject({
      method: "POST",
      url: "/api/v1/login",
      payload: { token: "test" },
    });
    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    assert.equal(
      (
        await x.app.inject({ url: "/api/v1/session", headers: { cookie } })
      ).json().authenticated,
      true,
    );
    await x.app.inject({
      method: "POST",
      url: "/api/v1/logout",
      headers: { cookie },
    });
    assert.equal(
      (
        await x.app.inject({ url: "/api/v1/session", headers: { cookie } })
      ).json().authenticated,
      false,
    );
    assert.equal(
      x.store.audits().filter((a: any) => a.action === "api.mutation").length,
      2,
    );
  } finally {
    await x.done();
  }
});
test("native relay Origin exemption does not permit unrelated APIs", async () => {
  const x = await fixture();
  try {
    await x.app.ready();
    for (const origin of [
      "tauri://localhost",
      "http://tauri.localhost",
      "https://live.douyin.com",
    ]) {
      assert.equal(
        (
          await x.app.inject({
            url: "/api/v1/state",
            headers: { ...x.headers, origin },
          })
        ).statusCode,
        403,
      );
      const room = x.store.list("rooms").find((r) => r.platform === "douyin");
      const token = (
        await x.app.inject({
          url: "/api/v1/relay-config/" + room.id,
          headers: x.headers,
        })
      )
        .json()
        .url.split("token=")[1];
      await assert.rejects(
        x.app.injectWS("/api/v1/relay/" + room.id, { headers: { origin } }),
        /403/,
      );
      const ws = await x.app.injectWS(
        "/api/v1/relay/" + room.id + "?token=" + token,
        { headers: { origin } },
      );
      assert.ok(x.adapters.connections.has(room.id));
      x.adapters.connections.get(room.id)?.terminate();
      ws.terminate();
      await new Promise((r) => setTimeout(r, 10));
    }
  } finally {
    await x.done();
  }
});
