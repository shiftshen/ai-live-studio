import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/server/store.ts";
import { Engine } from "../src/server/engine.ts";
function fixture() {
  const s = new Store(":memory:");
  const e = new Engine(s);
  const room = s.list("rooms")[0];
  return { s, e, room };
}
function ev(room: any, patch: any = {}) {
  return {
    roomId: room.id,
    sessionId: room.sessionId,
    platform: room.platform,
    sourceId: "msg1",
    userId: "u1",
    nickname: "测试用户",
    type: "comment",
    origin: "live",
    text: "你好",
    count: 1,
    occurredAt: Date.now(),
    ...patch,
  };
}
test("duplicate event produces only one action set", () => {
  const { s, e, room } = fixture();
  e.ingest(ev(room));
  e.ingest(ev(room));
  assert.equal(s.list("events").length, 1);
  assert.equal(s.list("jobs").length, 3);
  s.close();
});
test("gift cumulative 1 2 3 ends with one receipt of 3", () => {
  const { s, e, room } = fixture();
  for (const n of [1, 2, 3])
    e.ingest(
      ev(room, {
        type: "gift",
        text: "",
        giftId: "rose",
        giftName: "玫瑰",
        sourceId: `s${n}`,
        count: n,
        streakId: "combo",
        streakable: true,
        repeatEnd: false,
      }),
    );
  assert.equal(s.list("jobs").length, 0);
  e.ingest(
    ev(room, {
      type: "gift",
      text: "",
      giftId: "rose",
      giftName: "玫瑰",
      sourceId: "end",
      count: 3,
      streakId: "combo",
      streakable: true,
      repeatEnd: true,
    }),
  );
  assert.equal(s.list("jobs").length, 3);
  assert.match(s.list("jobs")[0].content, /3/);
  s.close();
});
test("replay cannot create pending physical print", () => {
  const { s, e, room } = fixture();
  e.ingest(ev(room, { origin: "replay" }));
  assert.equal(
    s.list("jobs").find((j: any) => j.action === "print").status,
    "dry_run",
  );
  s.close();
});
test("history recorded without any actions", () => {
  const { s, e, room } = fixture();
  e.ingest(ev(room, { historical: true }));
  assert.equal(s.list("jobs").length, 0);
  s.close();
});
test("like milestones 10/50/100 each trigger expected action sets", () => {
  const { s, e, room } = fixture();
  for (const rule of s.list("rules"))
    if (rule.roomId === room.id && rule.eventType === "like")
      s.put("rules", { ...rule, enabled: false });
  const addLikeRule = (minCount: number, actions: string[]) => {
    s.put("rules", {
      id: randomUUID(),
      roomId: room.id,
      enabled: true,
      priority:
        minCount === 100 ? 100 : minCount === 50 ? 90 : minCount === 10 ? 80 : 70,
      eventType: "like",
      name: `点赞档位-${minCount}`,
      keywords: [],
      giftIds: [],
      minCount,
      cooldownSec: 0,
      oncePerSession: false,
      continueMatching: false,
      templateId: `like-${room.language}`,
      actions,
      ai: false,
      avatar: false,
      version: 1,
    });
  };
  addLikeRule(10, ["speech", "overlay"]);
  addLikeRule(50, ["speech", "overlay"]);
  addLikeRule(100, ["print", "speech", "overlay"]);
  const base = ev(room, {
    type: "like",
    count: 1,
    text: "",
    sourceId: "seed",
    origin: "live",
    identityReliable: true,
  });
  e.ingest({ ...base, sourceId: "l5", count: 5 });
  assert.equal(s.list("jobs").length, 0);
  e.ingest({ ...base, sourceId: "l10", count: 10 });
  assert.equal(s.list("jobs").length, 2);
  e.ingest({ ...base, sourceId: "l40", count: 40 });
  assert.equal(s.list("jobs").length, 4);
  e.ingest({ ...base, sourceId: "l50", count: 50 });
  assert.equal(s.list("jobs").length, 6);
  e.ingest({ ...base, sourceId: "l100", count: 100 });
  assert.equal(s.list("jobs").length, 9);
  const actions = s
    .list("jobs")
    .map((j: any) => j.action)
    .sort();
  assert.deepEqual(actions, [
    "overlay",
    "overlay",
    "overlay",
    "overlay",
    "print",
    "speech",
    "speech",
    "speech",
    "speech",
  ]);
  s.close();
});
test("room boundary rejected", () => {
  const { s, e, room } = fixture();
  assert.throws(() =>
    e.ingest(
      ev(room, { platform: room.platform === "douyin" ? "tiktok" : "douyin" }),
    ),
  );
  s.close();
});
test("cooldown and once-per-session are durable", () => {
  const { s, e, room } = fixture();
  e.ingest(ev(room));
  e.ingest(ev(room, { sourceId: "msg2" }));
  assert.equal(s.list("jobs").length, 3);
  s.close();
});
test("blocked fan produces no feedback", () => {
  const { s, e, room } = fixture();
  s.put("blockedUsers", { id: `${room.id}:u1`, roomId: room.id, userId: "u1" });
  e.ingest(ev(room));
  assert.equal(s.list("jobs").length, 0);
  s.close();
});
test("old like-rule schema upgrades to 10/50/100 milestones", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-upgrade-"));
  const path = join(dir, "studio.sqlite3");
  const legacy = new Store(path);
  const room = legacy.list("rooms")[0];
  for (const rule of legacy.list("rules")) {
    if (rule.roomId === room.id && rule.eventType === "like")
      legacy.delete("rules", rule.id);
  }
  legacy.put("rules", {
    id: "legacy-like-100",
    roomId: room.id,
    name: "点赞里程碑",
    enabled: true,
    priority: 20,
    eventType: "like",
    keywords: [],
    giftIds: [],
    minCount: 100,
    cooldownSec: 60,
    oncePerSession: false,
    continueMatching: false,
    templateId: "like-zh",
    actions: ["overlay"],
    ai: false,
    avatar: false,
    version: 1,
  });
  legacy.setting("initialized", true);
  legacy.setting("schemaVersion", 1);
  legacy.close();
  const s = new Store(path);
  const roomRules = s
    .list("rules")
    .filter((r: any) => r.roomId === room.id && r.eventType === "like");
  const counts = roomRules.map((r: any) => r.minCount).sort((a, b) => a - b);
  assert.deepEqual(counts, [10, 50, 100]);
  for (const rule of roomRules) assert.ok(rule.id);
  s.close();
  rmSync(dir, { recursive: true, force: true });
});

test("existing join rules without speech are upgraded to include speech", () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-join-upgrade-"));
  const path = join(dir, "studio.sqlite3");
  const legacy = new Store(path);
  const room = legacy.list("rooms")[0];
  for (const rule of legacy.list("rules")) {
    if (rule.roomId === room.id && rule.eventType === "join") {
      legacy.put("rules", { ...rule, actions: ["overlay"] });
    }
  }
  legacy.setting("initialized", true);
  legacy.setting("schemaVersion", 2);
  legacy.close();

  const s = new Store(path);
  const upgraded = s
    .list("rules")
    .find((r: any) => r.roomId === room.id && r.eventType === "join");
  assert.ok(Array.isArray(upgraded?.actions));
  assert.ok(upgraded.actions.includes("overlay"));
  assert.ok(upgraded.actions.includes("speech"));
  s.close();
  rmSync(dir, { recursive: true, force: true });
});
test("stale session cannot trigger feedback", () => {
  const { s, e, room } = fixture();
  assert.throws(() => e.ingest(ev(room, { sessionId: "old" })));
  s.close();
});
test("preview has no side effects", () => {
  const { s, e, room } = fixture();
  assert.equal(e.preview(ev(room)).matches.length, 1);
  assert.equal(s.list("events").length, 0);
  assert.equal(s.list("jobs").length, 0);
  s.close();
});
test("lost gift end becomes review, late end settles once", () => {
  const { s, e, room } = fixture();
  const base = ev(room, {
    type: "gift",
    giftId: "r",
    giftName: "Rose",
    streakable: true,
    streakId: "x",
    repeatEnd: false,
  });
  e.ingest(base);
  e.expireStreaks(Date.now() + 11000);
  assert.equal(s.list("streaks")[0].status, "needs_review");
  e.ingest({ ...base, sourceId: "end", repeatEnd: true, count: 2 });
  e.ingest({ ...base, sourceId: "end2", repeatEnd: true, count: 2 });
  assert.equal(s.list("jobs").length, 3);
  s.close();
});
test("pruning old event cannot reset an existing physical job", () => {
  const { s, e, room } = fixture();
  const raw = ev(room, { type: "gift", giftId: "rose", giftName: "Rose" });
  const first = e.ingest(raw);
  const print = first.jobs.find((j) => j.action === "print");
  s.put("jobs", { ...print, status: "completed" });
  s.delete("events", first.event.id);
  e.ingest(raw);
  assert.equal(s.get("jobs", print.id).status, "completed");
  s.close();
});

test("streak expiration finds old pending records beyond ten thousand settled records", () => {
  const { s, e, room } = fixture();
  try {
    const now = Date.now();
    const base = ev(room, {
      type: "gift",
      giftId: "rose",
      streakId: "old-combo",
      streakable: true,
      repeatEnd: false,
    });
    const result = e.ingest(base);
    const pending = s.list("streaks")[0];
    s.put("streaks", { ...pending, at: now - 20000, createdAt: 1 });
    s.tx(() => {
      for (let i = 0; i < 10000; i++)
        s.put("streaks", {
          id: `settled-${i}`,
          status: "settled",
          at: now,
          createdAt: i + 2,
        });
    });
    e.expireStreaks(now);
    assert.equal(s.get("streaks", pending.id).status, "needs_review");
    assert.equal(s.get("events", result.event.id).status, "needs_review");
    assert.equal(s.count("jobs"), 0);
  } finally {
    s.close();
  }
});

test("missing platform identity can still participate in rewards for matched events", () => {
  const { s, e, room } = fixture();
  e.ingest(ev(room, { identityReliable: false }));
  assert.ok(["matched", "identity_unverified"].includes(s.list("events")[0].status));
  assert.ok(s.list("jobs").length > 0);
  s.close();
});

test("like events can trigger rewards even when identity is unverified", () => {
  const { s, e, room } = fixture();
  try {
    for (const rule of s.list("rules")) {
      if (rule.eventType === "like" && rule.roomId === room.id)
        s.put("rules", { ...rule, enabled: true });
    }
    e.ingest(
      ev(room, {
        type: "like",
        userId: "unverified-audience",
        identityReliable: false,
        count: 10,
      }),
    );
    assert.equal(s.list("jobs").length > 0, true);
    assert.equal(
      s.list("jobs").filter((j: any) => j.action === "print").length > 0,
      false,
    );
    assert.equal(s.list("events")[0].status, "matched");
  } finally {
    s.close();
  }
});

test("accepted printer work consumes capacity while held jobs do not prevent later admission", () => {
  const { s, e, room } = fixture();
  try {
    room.printerId = "printer-capacity";
    s.put("rooms", room);
    s.setting("config", { ...s.setting("config"), printQueueLimit: 1 });
    s.put("jobs", {
      id: "cloud-pending",
      action: "print",
      printerId: room.printerId,
      status: "accepted",
    });
    const first = e.ingest(
      ev(room, { sourceId: "capacity-1", userId: "capacity-1" }),
    );
    assert.equal(
      first.jobs.find((j: any) => j.action === "print").status,
      "held",
    );
    s.put("jobs", { ...s.get("jobs", "cloud-pending"), status: "completed" });
    const next = e.ingest(
      ev(room, { sourceId: "capacity-2", userId: "capacity-2" }),
    );
    assert.equal(
      next.jobs.find((j: any) => j.action === "print").status,
      "pending",
    );
  } finally {
    s.close();
  }
});
