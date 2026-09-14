import test from "node:test";
import assert from "node:assert/strict";
import { campaignPreset } from "../src/shared/campaign.ts";
import { Store } from "../src/server/store.ts";
import { Engine } from "../src/server/engine.ts";
import { createApp } from "../src/server/app.ts";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("live reward board only exposes enabled gift rules from its authenticated room", async () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-campaign-"));
  const x = await createApp({
    dir,
    workers: false,
    bootstrapToken: "test-only",
  });
  try {
    const [room, other] = x.store.list("rooms");
    for (const rule of x.store.list("rules"))
      x.store.put("rules", { ...rule, enabled: false });
    const rule = {
      id: "visible",
      roomId: room.id,
      enabled: true,
      eventType: "gift",
      minCount: 10,
      name: "专属祝福",
      giftIds: [],
      actions: ["speech", "overlay"],
    };
    x.store.put("rules", rule);
    x.store.put("rules", { ...rule, id: "other-room", roomId: other.id });
    x.store.put("rules", { ...rule, id: "disabled", enabled: false });
    x.store.put("rules", { ...rule, id: "comment", eventType: "comment" });
    assert.equal(
      (await x.app.inject({ url: `/api/v1/overlay/${room.id}?token=wrong` }))
        .statusCode,
      403,
    );
    const url = `/api/v1/overlay/${room.id}?token=${room.overlayToken}`;
    let response = await x.app.inject({ url });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      response.json().rewards.map((r: any) => r.id),
      ["visible"],
    );
    x.store.put("rules", { ...rule, name: "新的回馈", minCount: 66 });
    response = await x.app.inject({ url });
    assert.equal(response.json().rewards[0].minCount, 66);
    assert.equal(response.json().rewards[0].name, "新的回馈");
  } finally {
    await x.app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
for (const language of ["zh", "th"] as const) {
  test(`${language} campaign selects final gift tier exactly once without printing`, () => {
    const s = new Store(":memory:"),
      room = s.list("rooms")[0],
      e = new Engine(s);
    for (const r of s.list("rules")) s.put("rules", { ...r, enabled: false });
    for (const p of campaignPreset(language)) {
      s.put("templates", { id: p.key, body: p.body, language, version: 1 });
      s.put("rules", {
        ...p,
        id: p.key,
        roomId: room.id,
        enabled: true,
        giftIds: [],
        templateId: p.key,
        actions: ["speech", "overlay"],
        continueMatching: false,
        avatar: true,
        ai: false,
        version: 1,
      });
    }
    const base = {
      roomId: room.id,
      sessionId: room.sessionId,
      platform: room.platform,
      userId: "audience",
      nickname: language === "zh" ? "小明" : "สมชาย",
      type: "gift",
      origin: "live",
      giftId: "real-test-fixture",
      giftName: language === "zh" ? "玫瑰" : "กุหลาบ",
      streakId: "combo",
      streakable: true,
      occurredAt: Date.now(),
    };
    for (const count of [1, 10, 66])
      e.ingest({ ...base, sourceId: String(count), count, repeatEnd: false });
    assert.equal(s.list("jobs").length, 0);
    e.ingest({ ...base, sourceId: "end", count: 66, repeatEnd: true });
    e.ingest({ ...base, sourceId: "end", count: 66, repeatEnd: true });
    const jobs = s.list("jobs");
    assert.equal(jobs.length, 2);
    assert.ok(
      jobs.every((j) => j.ruleId === "gift-66" && j.action !== "print"),
    );
    assert.ok(
      jobs.every(
        (j) =>
          j.content.includes("66") &&
          j.content.includes(base.nickname) &&
          j.content.includes(base.giftName),
      ),
    );
    s.close();
  });
}
test("all campaign texts are bounded and greetings localized", () => {
  for (const l of ["zh", "th"] as const) {
    const p = campaignPreset(l);
    assert.equal(p.length, 10);
    assert.ok(p.every((r) => r.body.length <= 400));
    assert.ok(
      (
        p.find((r) => r.key === "hello")!.keywords as readonly string[]
      ).includes(l === "zh" ? "你好" : "สวัสดี"),
    );
    assert.deepEqual(
      p.filter((r) => r.eventType === "gift").map((r) => r.minCount),
      [1, 10, 66],
    );
    assert.deepEqual(
      p.filter((r) => r.eventType === "like").map((r) => r.minCount),
      [10, 50, 100],
    );
    assert.deepEqual(p.find((r) => r.key === "follow")!.actions, [
      "print",
      "speech",
      "overlay",
    ]);
    assert.ok(
      (p.find((r) => r.key === "hello")!.actions as readonly string[]).includes(
        "print",
      ),
    );
  }
});

test("overlay reports current-session live totals", async () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-overlay-totals-"));
  const x = await createApp({
    dir,
    workers: false,
    bootstrapToken: "test-only",
  });
  try {
    const room = x.store.list("rooms")[0];
    const base = {
      roomId: room.id,
      sessionId: room.sessionId,
      platform: room.platform,
      origin: "live",
      identityReliable: true,
      occurredAt: Date.now(),
      receivedAt: Date.now(),
      status: "unmatched",
      text: "",
    };
    x.store.put("events", {
      ...base,
      id: "j",
      sourceId: "j",
      userId: "u1",
      nickname: "甲",
      type: "join",
      count: 1,
    });
    x.store.put("events", {
      ...base,
      id: "f",
      sourceId: "f",
      userId: "u1",
      nickname: "甲",
      type: "follow",
      count: 1,
    });
    x.store.put("events", {
      ...base,
      id: "l1",
      sourceId: "l1",
      userId: "u1",
      nickname: "甲",
      type: "like",
      count: 7,
    });
    x.store.put("events", {
      ...base,
      id: "l2",
      sourceId: "l2",
      userId: "u2",
      nickname: "乙",
      type: "like",
      count: 5,
    });
    const response = await x.app.inject({
      url: `/api/v1/overlay/${room.id}?token=${room.overlayToken}`,
    });
    assert.deepEqual(response.json().totals, {
      viewers: 1,
      follows: 1,
      likes: 12,
      gifts: 0,
    });
  } finally {
    await x.app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("live stage is a camera-first HUD with visible live counters", () => {
  const source = readFileSync("src/client/components/LiveStage.vue", "utf8");
  for (const label of ["实拍打印区", "点赞", "关注", "礼物", "进场"])
    assert.ok(source.includes(label), `missing ${label}`);
  assert.ok(source.includes("totals.likes"));
  assert.match(source, /background:\s*transparent/);
  const native = readFileSync("src/native/LiveStage.swift", "utf8");
  assert.ok(native.includes("window.isOpaque=false"));
  assert.ok(native.includes('forKey:"drawsBackground"'));
});
