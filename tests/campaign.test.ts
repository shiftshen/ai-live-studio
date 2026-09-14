import test from "node:test";
import assert from "node:assert/strict";
import { campaignPreset } from "../src/shared/campaign.ts";
import { Store } from "../src/server/store.ts";
import { Engine } from "../src/server/engine.ts";
import { createApp } from "../src/server/app.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("live reward board only exposes enabled gift rules from its authenticated room", async () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-campaign-"));
  const x = await createApp({ dir, workers: false, bootstrapToken: "test-only" });
  try {
    const [room, other] = x.store.list("rooms");
    for (const rule of x.store.list("rules")) x.store.put("rules", { ...rule, enabled: false });
    const rule = { id: "visible", roomId: room.id, enabled: true, eventType: "gift", minCount: 10, name: "专属祝福", giftIds: [], actions: ["speech", "overlay"] };
    x.store.put("rules", rule);
    x.store.put("rules", { ...rule, id: "other-room", roomId: other.id });
    x.store.put("rules", { ...rule, id: "disabled", enabled: false });
    x.store.put("rules", { ...rule, id: "comment", eventType: "comment" });
    assert.equal((await x.app.inject({ url: `/api/v1/overlay/${room.id}?token=wrong` })).statusCode, 403);
    const url = `/api/v1/overlay/${room.id}?token=${room.overlayToken}`;
    let response = await x.app.inject({ url });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().rewards.map((r: any) => r.id), ["visible"]);
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
    assert.equal(p.length, 7);
    assert.ok(p.every((r) => r.body.length <= 400));
    assert.ok(
      p
        .find((r) => r.key === "hello")!
        .keywords.includes(l === "zh" ? "你好" : "สวัสดี"),
    );
    assert.deepEqual(
      p.filter((r) => r.eventType === "gift").map((r) => r.minCount),
      [1, 10, 66],
    );
  }
});
