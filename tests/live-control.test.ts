import test from "node:test";
import assert from "node:assert/strict";
import {
  readiness,
  requestInit,
  printerOnline,
} from "../scripts/live-control.mjs";

test("readiness reports the four operator-visible preflight checks", async () => {
  const result = await readiness({
    health: async () => true,
    appExists: () => true,
    printer: async () => ({ configured: true, enabled: true, status: "在线" }),
    room: async () => ({ status: "connected" }),
  });
  assert.deepEqual(result, {
    service: true,
    collector: true,
    printer: true,
    camera: true,
  });
});

test("Feie normal status is accepted while offline is rejected", () => {
  assert.equal(printerOnline("The online working condition is normal"), true);
  assert.equal(printerOnline("offline"), false);
  assert.equal(printerOnline("unverified"), false);
});

test("bodyless POST does not claim to contain JSON", () => {
  const init = requestInit("POST", "secret");
  assert.equal(init.body, undefined);
  assert.equal(init.headers["content-type"], undefined);
});
