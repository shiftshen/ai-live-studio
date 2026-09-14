import { test } from "node:test";
import assert from "node:assert/strict";
import { assess } from "../scripts/acceptance-soak.ts";
const sample = (at: number, overrides: any = {}) => ({
  at,
  ok: true,
  uptime: at / 1000 + 10,
  pid: 1,
  rssKb: 100,
  rooms: [{ platform: "tiktok", status: "connected" }],
  groups: [{ platform: "tiktok", n: 1 }],
  queue: [],
  errors: [],
  dbBytes: 1,
  ...overrides,
});
test("in-progress must never pass", () =>
  assert.equal(
    assess([sample(0), sample(60000)], 120, 60, ["tiktok"]).passed,
    false,
  ));
test("real-data absence fails despite connected status", () =>
  assert.deepEqual(
    assess([sample(0), sample(60000, { groups: [] })], 60, 60, ["tiktok"])
      .failures,
    ["tiktok:no_live_data_interval"],
  ));
test("restart and connection errors persist after recovery", () => {
  const r = assess(
    [
      sample(0),
      sample(60000, { pid: 2, rooms: [] }),
      sample(120000, { pid: 2 }),
    ],
    120,
    60,
    ["tiktok"],
  );
  assert.equal(r.passed, false);
  assert.equal(r.restartCount, 1);
  assert.ok(r.failures.includes("tiktok:disconnected"));
});
test("complete continuously healthy observations pass their scoped gate", () =>
  assert.equal(
    assess([sample(0), sample(60000)], 60, 60, ["tiktok"]).passed,
    true,
  ));
test("missed sampling interval fails", () =>
  assert.ok(
    assess([sample(0), sample(180000)], 180, 60, []).failures.includes(
      "sampling_gap",
    ),
  ));
