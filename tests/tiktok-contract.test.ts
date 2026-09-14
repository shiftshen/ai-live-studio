import test from "node:test";
import assert from "node:assert/strict";
import { WebcastGiftMessage, Gift } from "tiktok-live-proto/v3";
import { tiktokGiftFields, platformTime } from "../src/server/adapters.ts";
import { Store } from "../src/server/store.ts";
import { Engine } from "../src/server/engine.ts";

test("connector v3 protobuf gift start/end produces one final action set", () => {
  const s = new Store(":memory:");
  try {
    const room = s.list("rooms").find((r: any) => r.platform === "tiktok");
    const engine = new Engine(s);
    for (const [index, end] of [0, 1, 1].entries()) {
      const raw = WebcastGiftMessage.decode(
        WebcastGiftMessage.encode({
          ...WebcastGiftMessage.decode(new Uint8Array()),
          giftId: "5655",
          groupId: "123456789",
          repeatCount: 3,
          repeatEnd: end,
          gift: {
            ...Gift.decode(new Uint8Array()),
            id: "5655",
            name: "Rose",
            type: 1,
          },
        }).finish(),
      );
      const fields = tiktokGiftFields(raw);
      assert.equal(fields.streakable, true);
      assert.equal(fields.repeatEnd, end === 1);
      assert.equal(fields.giftName, "Rose");
      engine.ingest({
        roomId: room.id,
        sessionId: room.sessionId,
        platform: "tiktok",
        sourceId: `msg-${index}`,
        userId: "u",
        nickname: "test",
        type: "gift",
        origin: "simulated",
        text: "",
        count: raw.repeatCount,
        occurredAt: Date.now(),
        ...fields,
      });
      assert.equal(s.list("jobs").length, end ? 3 : 0);
    }
    assert.equal(
      s.list("jobs").filter((j: any) => j.action === "print").length,
      1,
    );
  } finally {
    s.close();
  }
});

test("legacy gift fields remain compatible and numeric zero is not an end", () => {
  assert.equal(
    tiktokGiftFields({
      giftDetails: { giftType: 1, giftName: "Legacy" },
      repeatEnd: 0,
    }).repeatEnd,
    false,
  );
  assert.equal(
    tiktokGiftFields({
      giftDetails: { giftType: 1, giftName: "Legacy" },
      repeatEnd: true,
    }).streakable,
    true,
  );
  assert.equal(
    tiktokGiftFields({ gift: { type: 2, name: "One shot" }, repeatEnd: 0 })
      .streakable,
    false,
  );
});

test("platform timestamps accept millisecond v3 and second legacy values", () => {
  assert.equal(platformTime("1789376901000"), 1789376901000);
  assert.equal(platformTime("1789376901"), 1789376901000);
  assert.equal(platformTime(undefined, 123), 123);
  assert.equal(platformTime("invalid", 123), 123);
});
